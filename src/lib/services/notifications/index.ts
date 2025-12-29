/**
 * Notification Service - SMS & Email notifications to clients and buyers
 */

interface ClientNotificationData {
  phone?: string;
  email?: string;
  name: string;
}

interface OrderItem {
  title: string;
  quantity: number;
  price: number;
}

interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(to: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    console.warn('[SMS] Twilio not configured, skipping');
    return;
  }

  const twilio = await import('twilio');
  const client = twilio.default(accountSid, authToken);

  await client.messages.create({
    to,
    from: fromPhone,
    body: message,
  });
}

/**
 * Send email via SendGrid/Resend
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn('[Email] No email provider configured, skipping');
    return;
  }

  // TODO: Implement with SendGrid or Resend
  console.log(`[Email] To: ${to}, Subject: ${subject}`);
}

/**
 * Notify client when item is listed
 */
export async function notifyItemListed(data: {
  client: ClientNotificationData;
  item: {
    description: string;
    shortCode: string;
    clientNet: number;
    listPrice: number;
  };
  appUrl: string;
}): Promise<void> {
  const { client, item, appUrl } = data;

  const smsMessage = `Your item is now live!

${item.description}
Your Net: $${item.clientNet}
Listed: $${item.listPrice}

Sold in store? Text:
REMOVE ${item.shortCode}`;

  const notifications = [];

  if (client.phone) {
    notifications.push(sendSMS(client.phone, smsMessage));
  }

  if (client.email) {
    const emailHTML = `
      <h2>Your item is now live!</h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h3>${item.description}</h3>
        <p><strong>Your Net:</strong> $${item.clientNet}</p>
        <p><strong>Listed Price:</strong> $${item.listPrice}</p>
      </div>
      <p>Sold in store? Remove it instantly by texting REMOVE ${item.shortCode}</p>
      <p><a href="${appUrl}/portal">View in Portal</a></p>
    `;
    notifications.push(sendEmail(client.email, `Listed: ${item.description}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify client when item sells
 */
export async function notifyItemSold(data: {
  client: ClientNotificationData;
  item: {
    description: string;
    clientNet: number;
  };
  buyer: {
    name: string;
    address: string;
  };
}): Promise<void> {
  const { client, item, buyer } = data;

  const smsMessage = `🎉 SOLD: ${item.description}

Ship to:
${buyer.name}
${buyer.address}

You'll be paid $${item.clientNet} within 24hrs of delivery.`;

  const notifications = [];

  if (client.phone) {
    notifications.push(sendSMS(client.phone, smsMessage));
  }

  if (client.email) {
    const emailHTML = `
      <h2>🎉 Your item sold!</h2>
      <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
        <h3>${item.description}</h3>
        <p><strong>You'll receive:</strong> $${item.clientNet}</p>
      </div>
      <h4>Ship to:</h4>
      <p>${buyer.name}<br>${buyer.address}</p>
    `;
    notifications.push(sendEmail(client.email, `SOLD: ${item.description}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify client when submission is declined
 */
export async function notifySubmissionDeclined(data: {
  client: ClientNotificationData;
  submission: {
    description: string;
    desiredNet: number;
  };
  reason: string;
  suggestedNet?: number;
}): Promise<void> {
  const { client, submission, reason, suggestedNet } = data;

  if (client.email) {
    const emailHTML = `
      <h2>Submission Update</h2>
      <p>${submission.description}</p>
      <p>Requested net: $${submission.desiredNet}</p>
      <p>${reason}</p>
      ${suggestedNet ? `<p>We could accept at <strong>$${suggestedNet.toFixed(2)}</strong> net.</p>` : ''}
    `;
    await sendEmail(client.email, 'Submission Update', emailHTML);
  }
}

/**
 * Notify buyer when order is confirmed/paid
 */
export async function notifyOrderConfirmation(data: {
  buyer: ClientNotificationData;
  order: {
    orderNumber: string;
    items: OrderItem[];
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    shippingAddress: ShippingAddress;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, order, appUrl } = data;

  const itemsList = order.items
    .map((item) => `• ${item.title} (x${item.quantity}) - $${item.price.toFixed(2)}`)
    .join('\n');

  const notifications = [];

  if (buyer.phone) {
    const smsMessage = `Order Confirmed! #${order.orderNumber}

Total: $${order.total.toFixed(2)}

We'll notify you when it ships.

View: ${appUrl}/orders/${order.orderNumber}`;

    notifications.push(sendSMS(buyer.phone, smsMessage));
  }

  if (buyer.email) {
    const addressHTML = `
      ${order.shippingAddress.name}<br>
      ${order.shippingAddress.street1}<br>
      ${order.shippingAddress.street2 ? order.shippingAddress.street2 + '<br>' : ''}
      ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}<br>
      ${order.shippingAddress.country}
    `;

    const itemsHTML = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.title}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const emailHTML = `
      <h2>Order Confirmed!</h2>
      <p>Hi ${buyer.name},</p>
      <p>Thank you for your order. Here's your confirmation:</p>

      <h3>Order #${order.orderNumber}</h3>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: center;">Qty</th>
            <th style="padding: 10px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="text-align: right; padding: 5px;">Subtotal:</td><td style="text-align: right; padding: 5px; width: 100px;">$${order.subtotal.toFixed(2)}</td></tr>
        <tr><td style="text-align: right; padding: 5px;">Shipping:</td><td style="text-align: right; padding: 5px;">$${order.shipping.toFixed(2)}</td></tr>
        <tr><td style="text-align: right; padding: 5px;">Tax:</td><td style="text-align: right; padding: 5px;">$${order.tax.toFixed(2)}</td></tr>
        <tr style="font-weight: bold;"><td style="text-align: right; padding: 5px;">Total:</td><td style="text-align: right; padding: 5px;">$${order.total.toFixed(2)}</td></tr>
      </table>

      <h4>Shipping To:</h4>
      <p>${addressHTML}</p>

      <p><a href="${appUrl}/orders/${order.orderNumber}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Order</a></p>
    `;

    notifications.push(sendEmail(buyer.email, `Order Confirmed #${order.orderNumber}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify buyer when order ships
 */
export async function notifyOrderShipped(data: {
  buyer: ClientNotificationData;
  order: {
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
    items: Array<{ title: string; quantity: number }>;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, order, appUrl } = data;

  const trackingUrl = order.trackingUrl || getCarrierTrackingUrl(order.carrier, order.trackingNumber);

  const notifications = [];

  if (buyer.phone) {
    const smsMessage = `Your order #${order.orderNumber} has shipped!

Tracking: ${order.trackingNumber}
Carrier: ${order.carrier}

Track: ${trackingUrl}`;

    notifications.push(sendSMS(buyer.phone, smsMessage));
  }

  if (buyer.email) {
    const itemsHTML = order.items
      .map((item) => `<li>${item.title} (x${item.quantity})</li>`)
      .join('');

    const emailHTML = `
      <h2>Your Order Has Shipped!</h2>
      <p>Hi ${buyer.name},</p>
      <p>Great news! Your order #${order.orderNumber} is on its way.</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Carrier:</strong> ${order.carrier}</p>
        <p style="margin: 10px 0;"><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
      </div>

      <p><a href="${trackingUrl}" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Track Package</a></p>

      <h4>Items Shipped:</h4>
      <ul>${itemsHTML}</ul>

      <p><a href="${appUrl}/orders/${order.orderNumber}">View Order Details</a></p>
    `;

    notifications.push(sendEmail(buyer.email, `Order #${order.orderNumber} Shipped!`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify buyer when order is delivered
 */
export async function notifyOrderDelivered(data: {
  buyer: ClientNotificationData;
  order: {
    orderNumber: string;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, order, appUrl } = data;

  if (buyer.email) {
    const emailHTML = `
      <h2>Your Order Has Been Delivered!</h2>
      <p>Hi ${buyer.name},</p>
      <p>Your order #${order.orderNumber} has been delivered.</p>
      <p>We hope you love your purchase!</p>
      <p><a href="${appUrl}/orders/${order.orderNumber}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Order</a></p>
    `;

    await sendEmail(buyer.email, `Order #${order.orderNumber} Delivered`, emailHTML);
  }
}

function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string {
  const carrierUrls: Record<string, string> = {
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
  };

  return carrierUrls[carrier.toLowerCase()] || `https://parcelsapp.com/en/tracking/${trackingNumber}`;
}

// ============================================================================
// COLLECTOR MARKETPLACE NOTIFICATIONS
// ============================================================================

/**
 * Notify user when they've been outbid on an auction
 */
export async function notifyOutbid(data: {
  bidder: ClientNotificationData;
  auction: {
    id: string;
    title: string;
    currentBid: number;
    yourBid: number;
    endsAt: Date;
  };
  appUrl: string;
}): Promise<void> {
  const { bidder, auction, appUrl } = data;
  const endsIn = formatTimeRemaining(auction.endsAt);

  const notifications = [];

  if (bidder.phone) {
    const smsMessage = `You've been outbid! "${auction.title}" is now at $${auction.currentBid.toFixed(2)}. Your bid: $${auction.yourBid.toFixed(2)}. Ends ${endsIn}. Bid now: ${appUrl}/auctions/${auction.id}`;
    notifications.push(sendSMS(bidder.phone, smsMessage));
  }

  if (bidder.email) {
    const emailHTML = `
      <h2>You've Been Outbid!</h2>
      <p>Hi ${bidder.name},</p>
      <p>Someone has placed a higher bid on an item you're watching.</p>

      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="margin: 0 0 10px 0;">${auction.title}</h3>
        <p style="margin: 5px 0;"><strong>Current Bid:</strong> $${auction.currentBid.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Your Bid:</strong> $${auction.yourBid.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Ends:</strong> ${endsIn}</p>
      </div>

      <p><a href="${appUrl}/auctions/${auction.id}" style="display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Place Higher Bid</a></p>
    `;
    notifications.push(sendEmail(bidder.email, `Outbid Alert: ${auction.title}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify user when they've won an auction
 */
export async function notifyAuctionWon(data: {
  winner: ClientNotificationData;
  auction: {
    id: string;
    title: string;
    winningBid: number;
    totalWithFees: number;
  };
  appUrl: string;
}): Promise<void> {
  const { winner, auction, appUrl } = data;

  const notifications = [];

  if (winner.phone) {
    const smsMessage = `Congratulations! You won "${auction.title}" for $${auction.winningBid.toFixed(2)}! Complete checkout: ${appUrl}/auctions/${auction.id}/checkout`;
    notifications.push(sendSMS(winner.phone, smsMessage));
  }

  if (winner.email) {
    const emailHTML = `
      <h2>🎉 Congratulations, You Won!</h2>
      <p>Hi ${winner.name},</p>
      <p>You are the winning bidder!</p>

      <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h3 style="margin: 0 0 10px 0;">${auction.title}</h3>
        <p style="margin: 5px 0;"><strong>Winning Bid:</strong> $${auction.winningBid.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Total (incl. fees):</strong> $${auction.totalWithFees.toFixed(2)}</p>
      </div>

      <p>Please complete your purchase within 48 hours to secure your item.</p>

      <p><a href="${appUrl}/auctions/${auction.id}/checkout" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Complete Purchase</a></p>
    `;
    notifications.push(sendEmail(winner.email, `You Won: ${auction.title}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify seller when their auction ends
 */
export async function notifyAuctionEnded(data: {
  seller: ClientNotificationData;
  auction: {
    id: string;
    title: string;
    finalBid: number | null;
    winnerName?: string;
    bidCount: number;
  };
  appUrl: string;
}): Promise<void> {
  const { seller, auction, appUrl } = data;
  const sold = auction.finalBid !== null;

  if (seller.email) {
    const emailHTML = sold
      ? `
        <h2>Your Auction Has Ended - SOLD!</h2>
        <p>Hi ${seller.name},</p>
        <p>Great news! Your item has sold.</p>

        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${auction.title}</h3>
          <p style="margin: 5px 0;"><strong>Final Bid:</strong> $${auction.finalBid!.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Winner:</strong> ${auction.winnerName}</p>
          <p style="margin: 5px 0;"><strong>Total Bids:</strong> ${auction.bidCount}</p>
        </div>

        <p>The buyer has been notified. You'll receive shipping instructions once payment is confirmed.</p>

        <p><a href="${appUrl}/seller/auctions/${auction.id}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Details</a></p>
      `
      : `
        <h2>Your Auction Has Ended</h2>
        <p>Hi ${seller.name},</p>
        <p>Your auction has ended without any bids.</p>

        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${auction.title}</h3>
          <p style="margin: 5px 0;">No bids received</p>
        </div>

        <p>You can relist this item or adjust the starting price.</p>

        <p><a href="${appUrl}/seller/auctions/${auction.id}/relist" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Relist Item</a></p>
      `;

    await sendEmail(seller.email, sold ? `SOLD: ${auction.title}` : `Auction Ended: ${auction.title}`, emailHTML);
  }
}

/**
 * Notify user when a price alert is triggered
 */
export async function notifyPriceAlert(data: {
  user: ClientNotificationData;
  alert: {
    id: string;
    searchQuery: string;
    targetPrice: number;
  };
  item: {
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
  };
  appUrl: string;
}): Promise<void> {
  const { user, alert, item, appUrl } = data;
  const discount = ((alert.targetPrice - item.price) / alert.targetPrice * 100).toFixed(0);

  const notifications = [];

  if (user.phone) {
    const smsMessage = `Price Alert! "${item.title}" is now $${item.price.toFixed(2)} (${discount}% below your target of $${alert.targetPrice.toFixed(2)}). View: ${appUrl}/items/${item.id}`;
    notifications.push(sendSMS(user.phone, smsMessage));
  }

  if (user.email) {
    const emailHTML = `
      <h2>🔔 Price Alert Triggered!</h2>
      <p>Hi ${user.name},</p>
      <p>An item matching your saved search is now below your target price!</p>

      <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="max-width: 200px; border-radius: 4px; margin-bottom: 10px;">` : ''}
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 5px 0;"><strong>Current Price:</strong> <span style="color: #28a745; font-size: 1.2em;">$${item.price.toFixed(2)}</span></p>
        <p style="margin: 5px 0;"><strong>Your Target:</strong> $${alert.targetPrice.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Savings:</strong> ${discount}% below target</p>
      </div>

      <p style="font-size: 0.9em; color: #666;">Saved Search: "${alert.searchQuery}"</p>

      <p><a href="${appUrl}/items/${item.id}" style="display: inline-block; padding: 12px 24px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px;">View Item</a></p>
    `;
    notifications.push(sendEmail(user.email, `Price Alert: ${item.title} - $${item.price.toFixed(2)}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify seller when they receive an offer
 */
export async function notifyOfferReceived(data: {
  seller: ClientNotificationData;
  offer: {
    id: string;
    amount: number;
    message?: string;
    expiresAt: Date;
  };
  item: {
    id: string;
    title: string;
    listPrice: number;
  };
  buyer: {
    name: string;
  };
  appUrl: string;
}): Promise<void> {
  const { seller, offer, item, buyer, appUrl } = data;
  const percentOfList = ((offer.amount / item.listPrice) * 100).toFixed(0);

  const notifications = [];

  if (seller.phone) {
    const smsMessage = `New offer! ${buyer.name} offered $${offer.amount.toFixed(2)} for "${item.title}" (${percentOfList}% of list). View: ${appUrl}/seller/offers/${offer.id}`;
    notifications.push(sendSMS(seller.phone, smsMessage));
  }

  if (seller.email) {
    const emailHTML = `
      <h2>New Offer Received!</h2>
      <p>Hi ${seller.name},</p>
      <p>You've received an offer on your listing.</p>

      <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 5px 0;"><strong>List Price:</strong> $${item.listPrice.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Offer:</strong> <span style="font-size: 1.2em; color: #007bff;">$${offer.amount.toFixed(2)}</span> (${percentOfList}% of list)</p>
        <p style="margin: 5px 0;"><strong>From:</strong> ${buyer.name}</p>
        ${offer.message ? `<p style="margin: 10px 0; font-style: italic; color: #666;">"${offer.message}"</p>` : ''}
        <p style="margin: 5px 0;"><strong>Expires:</strong> ${formatTimeRemaining(offer.expiresAt)}</p>
      </div>

      <p>
        <a href="${appUrl}/seller/offers/${offer.id}?action=accept" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Accept</a>
        <a href="${appUrl}/seller/offers/${offer.id}?action=counter" style="display: inline-block; padding: 12px 24px; background: #ffc107; color: #000; text-decoration: none; border-radius: 5px; margin-right: 10px;">Counter</a>
        <a href="${appUrl}/seller/offers/${offer.id}?action=decline" style="display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Decline</a>
      </p>
    `;
    notifications.push(sendEmail(seller.email, `New Offer: $${offer.amount.toFixed(2)} for ${item.title}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify buyer when their offer is accepted
 */
export async function notifyOfferAccepted(data: {
  buyer: ClientNotificationData;
  offer: {
    id: string;
    amount: number;
  };
  item: {
    id: string;
    title: string;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, offer, item, appUrl } = data;

  const notifications = [];

  if (buyer.phone) {
    const smsMessage = `Your offer was accepted! "${item.title}" for $${offer.amount.toFixed(2)}. Complete purchase: ${appUrl}/checkout/offer/${offer.id}`;
    notifications.push(sendSMS(buyer.phone, smsMessage));
  }

  if (buyer.email) {
    const emailHTML = `
      <h2>🎉 Your Offer Was Accepted!</h2>
      <p>Hi ${buyer.name},</p>
      <p>Great news! The seller has accepted your offer.</p>

      <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 5px 0;"><strong>Agreed Price:</strong> $${offer.amount.toFixed(2)}</p>
      </div>

      <p>Please complete your purchase within 24 hours to secure this item.</p>

      <p><a href="${appUrl}/checkout/offer/${offer.id}" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Complete Purchase</a></p>
    `;
    notifications.push(sendEmail(buyer.email, `Offer Accepted: ${item.title}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify buyer when their offer is declined
 */
export async function notifyOfferDeclined(data: {
  buyer: ClientNotificationData;
  offer: {
    id: string;
    amount: number;
  };
  item: {
    id: string;
    title: string;
    listPrice: number;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, offer, item, appUrl } = data;

  if (buyer.email) {
    const emailHTML = `
      <h2>Offer Update</h2>
      <p>Hi ${buyer.name},</p>
      <p>Unfortunately, the seller has declined your offer.</p>

      <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 5px 0;"><strong>Your Offer:</strong> $${offer.amount.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>List Price:</strong> $${item.listPrice.toFixed(2)}</p>
      </div>

      <p>The item is still available. You can make a new offer or purchase at list price.</p>

      <p>
        <a href="${appUrl}/items/${item.id}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">View Item</a>
        <a href="${appUrl}/items/${item.id}?offer=true" style="display: inline-block; padding: 12px 24px; background: #6c757d; color: white; text-decoration: none; border-radius: 5px;">Make New Offer</a>
      </p>
    `;
    await sendEmail(buyer.email, `Offer Declined: ${item.title}`, emailHTML);
  }
}

/**
 * Notify buyer when they receive a counter offer
 */
export async function notifyCounterOffer(data: {
  buyer: ClientNotificationData;
  offer: {
    id: string;
    originalAmount: number;
    counterAmount: number;
    message?: string;
    expiresAt: Date;
  };
  item: {
    id: string;
    title: string;
  };
  appUrl: string;
}): Promise<void> {
  const { buyer, offer, item, appUrl } = data;

  const notifications = [];

  if (buyer.phone) {
    const smsMessage = `Counter offer! Seller countered your $${offer.originalAmount.toFixed(2)} with $${offer.counterAmount.toFixed(2)} for "${item.title}". View: ${appUrl}/offers/${offer.id}`;
    notifications.push(sendSMS(buyer.phone, smsMessage));
  }

  if (buyer.email) {
    const emailHTML = `
      <h2>Counter Offer Received!</h2>
      <p>Hi ${buyer.name},</p>
      <p>The seller has made a counter offer on your bid.</p>

      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 5px 0;"><strong>Your Offer:</strong> $${offer.originalAmount.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Counter Offer:</strong> <span style="font-size: 1.2em; color: #856404;">$${offer.counterAmount.toFixed(2)}</span></p>
        ${offer.message ? `<p style="margin: 10px 0; font-style: italic; color: #666;">"${offer.message}"</p>` : ''}
        <p style="margin: 5px 0;"><strong>Expires:</strong> ${formatTimeRemaining(offer.expiresAt)}</p>
      </div>

      <p>
        <a href="${appUrl}/offers/${offer.id}?action=accept" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Accept Counter</a>
        <a href="${appUrl}/offers/${offer.id}?action=counter" style="display: inline-block; padding: 12px 24px; background: #ffc107; color: #000; text-decoration: none; border-radius: 5px; margin-right: 10px;">Counter Again</a>
        <a href="${appUrl}/offers/${offer.id}?action=decline" style="display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Decline</a>
      </p>
    `;
    notifications.push(sendEmail(buyer.email, `Counter Offer: ${item.title} - $${offer.counterAmount.toFixed(2)}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify user when new items match their saved search
 */
export async function notifySavedSearchMatch(data: {
  user: ClientNotificationData;
  search: {
    id: string;
    name: string;
    query: string;
  };
  items: Array<{
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
  }>;
  appUrl: string;
}): Promise<void> {
  const { user, search, items, appUrl } = data;

  if (items.length === 0) return;

  const notifications = [];

  if (user.phone && items.length <= 3) {
    const itemList = items.map(i => `${i.title}: $${i.price.toFixed(2)}`).join('; ');
    const smsMessage = `New items for "${search.name}"! ${itemList}. View: ${appUrl}/search?saved=${search.id}`;
    notifications.push(sendSMS(user.phone, smsMessage));
  }

  if (user.email) {
    const itemsHTML = items.slice(0, 10).map(item => `
      <div style="display: inline-block; width: 200px; margin: 10px; vertical-align: top; text-align: center;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="width: 180px; height: 180px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 180px; height: 180px; background: #eee; border-radius: 4px;"></div>'}
        <p style="margin: 5px 0; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</p>
        <p style="margin: 0; font-weight: bold; color: #28a745;">$${item.price.toFixed(2)}</p>
      </div>
    `).join('');

    const emailHTML = `
      <h2>New Items for Your Saved Search!</h2>
      <p>Hi ${user.name},</p>
      <p>We found <strong>${items.length} new item${items.length > 1 ? 's' : ''}</strong> matching your saved search "${search.name}".</p>

      <div style="margin: 20px 0;">
        ${itemsHTML}
      </div>

      ${items.length > 10 ? `<p>...and ${items.length - 10} more items.</p>` : ''}

      <p><a href="${appUrl}/search?saved=${search.id}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View All Results</a></p>

      <p style="font-size: 0.8em; color: #666;">Search criteria: "${search.query}"</p>
    `;
    notifications.push(sendEmail(user.email, `${items.length} New Items: ${search.name}`, emailHTML));
  }

  await Promise.all(notifications);
}

/**
 * Notify seller when they receive a review
 */
export async function notifyNewReview(data: {
  seller: ClientNotificationData;
  review: {
    rating: number;
    title?: string;
    comment?: string;
  };
  buyer: {
    name: string;
  };
  item: {
    title: string;
  };
  appUrl: string;
}): Promise<void> {
  const { seller, review, buyer, item, appUrl } = data;
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  if (seller.email) {
    const emailHTML = `
      <h2>New Review Received!</h2>
      <p>Hi ${seller.name},</p>
      <p>${buyer.name} left a review for "${item.title}".</p>

      <div style="background: ${review.rating >= 4 ? '#d4edda' : review.rating >= 3 ? '#fff3cd' : '#f8d7da'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 1.5em; margin: 0 0 10px 0; color: #ffc107;">${stars}</p>
        ${review.title ? `<h4 style="margin: 0 0 10px 0;">${review.title}</h4>` : ''}
        ${review.comment ? `<p style="margin: 0; font-style: italic;">"${review.comment}"</p>` : ''}
        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #666;">— ${buyer.name}</p>
      </div>

      <p><a href="${appUrl}/seller/reviews" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View All Reviews</a></p>
    `;
    await sendEmail(seller.email, `New ${review.rating}-Star Review: ${item.title}`, emailHTML);
  }
}

/**
 * Notify watchers when an item they're watching has activity
 */
export async function notifyWatchlistActivity(data: {
  user: ClientNotificationData;
  item: {
    id: string;
    title: string;
    imageUrl?: string;
  };
  activity: {
    type: 'price_drop' | 'auction_ending' | 'new_offer' | 'low_stock';
    oldPrice?: number;
    newPrice?: number;
    endsAt?: Date;
    stockCount?: number;
  };
  appUrl: string;
}): Promise<void> {
  const { user, item, activity, appUrl } = data;

  const activityMessages: Record<string, { subject: string; body: string; urgency: string }> = {
    price_drop: {
      subject: `Price Drop: ${item.title}`,
      body: `The price dropped from $${activity.oldPrice?.toFixed(2)} to <strong>$${activity.newPrice?.toFixed(2)}</strong>!`,
      urgency: '#28a745',
    },
    auction_ending: {
      subject: `Ending Soon: ${item.title}`,
      body: `This auction ends ${formatTimeRemaining(activity.endsAt!)}. Don't miss out!`,
      urgency: '#dc3545',
    },
    new_offer: {
      subject: `Offers Available: ${item.title}`,
      body: 'The seller is now accepting offers on this item.',
      urgency: '#17a2b8',
    },
    low_stock: {
      subject: `Low Stock: ${item.title}`,
      body: `Only ${activity.stockCount} left! Buy now before it's gone.`,
      urgency: '#ffc107',
    },
  };

  const msg = activityMessages[activity.type];
  if (!msg) return;

  const notifications = [];

  if (user.phone) {
    const smsMessage = `${msg.subject} - ${msg.body.replace(/<[^>]*>/g, '')} View: ${appUrl}/items/${item.id}`;
    notifications.push(sendSMS(user.phone, smsMessage));
  }

  if (user.email) {
    const emailHTML = `
      <h2 style="color: ${msg.urgency};">${msg.subject}</h2>
      <p>Hi ${user.name},</p>
      <p>An item on your watchlist has new activity!</p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${msg.urgency};">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="max-width: 150px; border-radius: 4px; margin-bottom: 10px;">` : ''}
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="margin: 0;">${msg.body}</p>
      </div>

      <p><a href="${appUrl}/items/${item.id}" style="display: inline-block; padding: 12px 24px; background: ${msg.urgency}; color: white; text-decoration: none; border-radius: 5px;">View Item</a></p>
    `;
    notifications.push(sendEmail(user.email, msg.subject, emailHTML));
  }

  await Promise.all(notifications);
}

// Helper function for time formatting
function formatTimeRemaining(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) return 'ended';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days} day${days > 1 ? 's' : ''}`;
  }
  
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  
  return `in ${minutes} minutes`;
}
