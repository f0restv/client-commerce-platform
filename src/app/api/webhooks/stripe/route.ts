import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { notifyOrderConfirmation, notifyItemSold } from "@/lib/services/notifications";
import { processOrderPayout } from "@/lib/services/payouts";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.orderId;

        if (orderId) {
          await db.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              paymentIntentId: paymentIntent.id,
              paidAt: new Date(),
            },
          });

          // Fetch full order with relations for notifications
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      client: {
                        include: {
                          users: true,
                        },
                      },
                    },
                  },
                },
              },
              user: true,
              address: true,
            },
          });

          if (order) {
            // Update product status to SOLD
            for (const item of order.items) {
              await db.product.update({
                where: { id: item.productId },
                data: { status: "SOLD" },
              });
            }

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com";

            // Send order confirmation to buyer
            if (order.user && order.address) {
              await notifyOrderConfirmation({
                buyer: {
                  name: order.user.name || "Customer",
                  email: order.user.email,
                  phone: order.user.phone || undefined,
                },
                order: {
                  orderNumber: order.orderNumber,
                  items: order.items.map((item: { product: { title: string }; quantity: number; price: unknown }) => ({
                    title: item.product.title,
                    quantity: item.quantity,
                    price: Number(item.price),
                  })),
                  subtotal: Number(order.subtotal),
                  shipping: Number(order.shipping),
                  tax: Number(order.tax),
                  total: Number(order.total),
                  shippingAddress: {
                    name: order.address.name,
                    street1: order.address.street1,
                    street2: order.address.street2 || undefined,
                    city: order.address.city,
                    state: order.address.state,
                    zip: order.address.zip,
                    country: order.address.country,
                  },
                },
                appUrl,
              });
            }

            // Notify clients when their items sell
            for (const item of order.items) {
              const client = item.product.client;
              if (client) {
                // Find primary client user for notifications
                const clientUser = client.users[0];
                const clientContact = {
                  name: client.name,
                  email: clientUser?.email || client.email,
                  phone: clientUser?.phone || client.phone || undefined,
                };

                // Calculate client net (sold price minus commission)
                const soldPrice = Number(item.price);
                const commissionRate = Number(client.commissionRate) / 100;
                const clientNet = soldPrice * (1 - commissionRate);

                // Format buyer address
                const buyerAddress = order.address
                  ? `${order.address.street1}${order.address.street2 ? ", " + order.address.street2 : ""}, ${order.address.city}, ${order.address.state} ${order.address.zip}`
                  : "Address on file";

                await notifyItemSold({
                  client: clientContact,
                  item: {
                    description: item.product.title,
                    clientNet,
                  },
                  buyer: {
                    name: order.address?.name || order.user?.name || "Customer",
                    address: buyerAddress,
                  },
                });
              }
            }
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.metadata?.invoiceId;

        if (invoiceId) {
          await db.invoice.update({
            where: { id: invoiceId },
            data: {
              status: "PAID",
              paidAt: new Date(),
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.metadata?.invoiceId;

        if (invoiceId) {
          await db.invoice.update({
            where: { id: invoiceId },
            data: {
              status: "OVERDUE",
            },
          });
        }
        break;
      }

      // Stripe Checkout session completed - create order and trigger payouts
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const userId = checkoutSession.metadata?.userId;
        const productIds = checkoutSession.metadata?.productIds?.split(",") || [];

        if (userId && productIds.length > 0) {
          // Fetch products to create order
          const products = await db.product.findMany({
            where: { id: { in: productIds } },
          });

          const subtotal = products.reduce(
            (sum, p) => sum + Number(p.price || 0),
            0
          );
          const shipping = (checkoutSession.shipping_cost?.amount_total || 0) / 100;
          const tax = (checkoutSession.total_details?.amount_tax || 0) / 100;
          const total = subtotal + shipping + tax;

          // Get or create shipping address
          let addressId: string | null = null;
          // Cast to access shipping_details which exists on completed sessions
          const shippingDetails = (checkoutSession as unknown as { shipping_details?: { name?: string; address?: Stripe.Address } }).shipping_details;
          if (shippingDetails?.address) {
            const addr = shippingDetails.address;
            const existingAddress = await db.address.findFirst({
              where: {
                userId,
                street1: addr.line1 || "",
                city: addr.city || "",
                state: addr.state || "",
                zip: addr.postal_code || "",
              },
            });

            if (existingAddress) {
              addressId = existingAddress.id;
            } else {
              const newAddress = await db.address.create({
                data: {
                  userId,
                  name: shippingDetails.name || "Shipping Address",
                  street1: addr.line1 || "",
                  street2: addr.line2 || undefined,
                  city: addr.city || "",
                  state: addr.state || "",
                  zip: addr.postal_code || "",
                  country: addr.country || "US",
                },
              });
              addressId = newAddress.id;
            }
          }

          // Generate order number
          const orderCount = await db.order.count();
          const orderNumber = `ORD-${String(orderCount + 1).padStart(6, "0")}`;

          // Create order
          const order = await db.order.create({
            data: {
              orderNumber,
              userId,
              addressId,
              status: "PAID",
              subtotal,
              shipping,
              tax,
              total,
              paymentMethod: "stripe",
              paymentIntentId: checkoutSession.payment_intent as string,
              paidAt: new Date(),
              items: {
                create: products.map((p) => ({
                  productId: p.id,
                  quantity: 1,
                  price: p.price || 0,
                })),
              },
            },
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      client: {
                        include: {
                          users: true,
                        },
                      },
                    },
                  },
                },
              },
              user: true,
              address: true,
            },
          });

          // Update product status to SOLD
          for (const product of products) {
            await db.product.update({
              where: { id: product.id },
              data: { status: "SOLD" },
            });
          }

          // Trigger payouts to clients
          try {
            await processOrderPayout(order.id);
          } catch (payoutError) {
            console.error("Payout processing error:", payoutError);
            // Don't fail the webhook, payouts can be retried
          }

          // Send notifications (same as payment_intent.succeeded)
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com";

          if (order.user && order.address) {
            await notifyOrderConfirmation({
              buyer: {
                name: order.user.name || "Customer",
                email: order.user.email,
                phone: order.user.phone || undefined,
              },
              order: {
                orderNumber: order.orderNumber,
                items: order.items.map((item) => ({
                  title: item.product.title,
                  quantity: item.quantity,
                  price: Number(item.price),
                })),
                subtotal: Number(order.subtotal),
                shipping: Number(order.shipping),
                tax: Number(order.tax),
                total: Number(order.total),
                shippingAddress: {
                  name: order.address.name,
                  street1: order.address.street1,
                  street2: order.address.street2 || undefined,
                  city: order.address.city,
                  state: order.address.state,
                  zip: order.address.zip,
                  country: order.address.country,
                },
              },
              appUrl,
            });
          }

          // Notify clients when their items sell
          for (const item of order.items) {
            const client = item.product.client;
            if (client) {
              const clientUser = client.users[0];
              const clientContact = {
                name: client.name,
                email: clientUser?.email || client.email,
                phone: clientUser?.phone || client.phone || undefined,
              };

              const soldPrice = Number(item.price);
              const commissionRate = Number(client.commissionRate) / 100;
              const clientNet = soldPrice * (1 - commissionRate);

              const buyerAddress = order.address
                ? `${order.address.street1}${order.address.street2 ? ", " + order.address.street2 : ""}, ${order.address.city}, ${order.address.state} ${order.address.zip}`
                : "Address on file";

              await notifyItemSold({
                client: clientContact,
                item: {
                  description: item.product.title,
                  clientNet,
                },
                buyer: {
                  name: order.address?.name || order.user?.name || "Customer",
                  address: buyerAddress,
                },
              });
            }
          }
        }
        break;
      }

      // Connect account updated - track onboarding status
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const clientId = account.metadata?.clientId;

        if (clientId) {
          const status = account.details_submitted
            ? account.charges_enabled
              ? "complete"
              : "restricted"
            : "pending";

          await db.client.update({
            where: { id: clientId },
            data: { stripeAccountStatus: status },
          });
        }
        break;
      }

      // Transfer created - record payout initiated
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        const clientId = transfer.metadata?.clientId;

        if (clientId) {
          // Update payout status if exists
          await db.stripePayout.updateMany({
            where: {
              stripeTransferId: transfer.id,
              clientId,
            },
            data: { status: "IN_TRANSIT" },
          });
        }
        break;
      }

      // Payout to connected account completed
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        // For Connect payouts, we need to find by the destination account
        // The payout.paid event comes from the connected account context
        if (event.account) {
          // Find client by Stripe account ID
          const client = await db.client.findFirst({
            where: { stripeAccountId: event.account },
          });

          if (client) {
            // Update the most recent pending payout for this client
            await db.stripePayout.updateMany({
              where: {
                clientId: client.id,
                status: { in: ["PENDING", "IN_TRANSIT"] },
              },
              data: {
                status: "PAID",
                stripePayoutId: payout.id,
              },
            });
          }
        }
        break;
      }

      // Payout to connected account failed
      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        if (event.account) {
          const client = await db.client.findFirst({
            where: { stripeAccountId: event.account },
          });

          if (client) {
            await db.stripePayout.updateMany({
              where: {
                clientId: client.id,
                status: { in: ["PENDING", "IN_TRANSIT"] },
              },
              data: {
                status: "FAILED",
                stripePayoutId: payout.id,
                failureReason: payout.failure_message || "Unknown error",
              },
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
