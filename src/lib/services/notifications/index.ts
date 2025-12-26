/**
 * Notification Service - SMS & Email notifications to clients
 */

interface ClientNotificationData {
  phone?: string;
  email?: string;
  name: string;
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
