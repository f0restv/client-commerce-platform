import { NextRequest, NextResponse } from 'next/server';
import { stripe, constructWebhookEvent } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.order_id;

        if (orderId) {
          await supabase
            .from('orders')
            .update({
              status: 'paid',
              stripe_payment_intent_id: paymentIntent.id,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);

          console.log(`Order ${orderId} marked as paid`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const invoiceId = invoice.metadata?.invoice_id;

        if (invoiceId) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              amount_paid: (invoice.amount_paid || 0) / 100,
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);

          console.log(`Invoice ${invoiceId} marked as paid`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const invoiceId = invoice.metadata?.invoice_id;

        if (invoiceId) {
          await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoiceId);

          console.log(`Invoice ${invoiceId} marked as overdue`);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id;

        if (orderId && session.shipping_details) {
          await supabase
            .from('orders')
            .update({
              status: 'paid',
              shipping_name: session.shipping_details.name,
              shipping_street1: session.shipping_details.address?.line1,
              shipping_street2: session.shipping_details.address?.line2,
              shipping_city: session.shipping_details.address?.city,
              shipping_state: session.shipping_details.address?.state,
              shipping_zip: session.shipping_details.address?.postal_code,
              shipping_country: session.shipping_details.address?.country,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);

          console.log(`Checkout completed for order ${orderId}`);
        }
        break;
      }

      case 'customer.created': {
        const customer = event.data.object;
        const userId = customer.metadata?.user_id;

        if (userId) {
          await supabase
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('id', userId);

          console.log(`Stripe customer linked to user ${userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
