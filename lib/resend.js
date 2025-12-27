import { Resend } from 'resend';

let connectionSettings;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export async function sendWelcomeEmail(email, plan) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to SMS Manager for Techy Miramar! 🎉',
      html: `
        <h2>Welcome to SMS Manager!</h2>
        <p>Thank you for subscribing to our <strong>${plan.toUpperCase()}</strong> plan.</p>
        <p>You now have access to:</p>
        <ul>
          <li>Send SMS/MMS messages to customers</li>
          <li>Google review tracking with automatic follow-ups</li>
          <li>OCR text extraction from repair orders</li>
          <li>Customer database and analytics</li>
        </ul>
        <p>Get started by visiting your dashboard and sending your first message!</p>
        <p>If you have any questions, feel free to reach out.</p>
        <p>Best regards,<br>Techy Miramar Team</p>
      `
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
  }
}

export async function sendQuotaWarningEmail(email, plan, smsUsed, smsQuota, percentage) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const remaining = smsQuota - smsUsed;
    let subject, urgency;
    
    if (percentage >= 90) {
      subject = '⚠️ URGENT: You\'ve used 90% of your SMS quota';
      urgency = 'critical';
    } else {
      subject = '⚠️ You\'ve used 80% of your SMS quota';
      urgency = 'high';
    }
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: subject,
      html: `
        <h2>SMS Quota Warning</h2>
        <p>You have used <strong>${smsUsed} out of ${smsQuota} SMS messages</strong> (${percentage}%) on your ${plan.toUpperCase()} plan.</p>
        <p>You have <strong>${remaining} messages remaining</strong> this month.</p>
        ${urgency === 'critical' ? '<p style="color: #dc3545; font-weight: bold;">⚠️ Your quota is nearly exhausted. Consider upgrading to avoid service interruption.</p>' : ''}
        <p>To upgrade your plan or manage your subscription, visit your billing dashboard.</p>
        <p>Best regards,<br>Techy Miramar Team</p>
      `
    });
    console.log(`✅ Quota warning email sent to ${email} (${percentage}% used)`);
  } catch (error) {
    console.error(`❌ Failed to send quota warning to ${email}:`, error);
  }
}

export async function sendPaymentFailedEmail(email) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: '❌ Payment Failed - Action Required',
      html: `
        <h2>Payment Failed</h2>
        <p>We were unable to process your recent payment for your SMS Manager subscription.</p>
        <p>Your account will remain active for a limited time, but please update your payment method as soon as possible to avoid service interruption.</p>
        <p>To update your payment method, visit your billing portal.</p>
        <p>If you have any questions or believe this is an error, please contact us.</p>
        <p>Best regards,<br>Techy Miramar Team</p>
      `
    });
    console.log(`✅ Payment failed email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send payment failed email to ${email}:`, error);
  }
}

export async function sendPasswordResetEmail(email, resetToken, companyName, baseUrl) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const resetUrl = `${baseUrl || process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: '🔐 Password Reset Request - SMS Manager',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello from <strong>${companyName || 'SMS Manager'}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>Best regards,<br>SMS Manager Team</p>
      `
    });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error);
    throw error;
  }
}

export async function sendEmail(to, subject, html) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
}
