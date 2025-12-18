import crypto from 'crypto';
import { isCloudinaryEnabled } from '../utils/multerConfig.js';

async function checkOptOut(pool, phone) {
  const result = await pool.query(
    'SELECT id FROM sms_optouts WHERE phone = $1',
    [phone]
  );
  return result.rows.length > 0;
}

export const sendReviewRequest = (pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload) => async (req, res) => {
  try {
    const { customerName, customerPhone, messageType, additionalInfo, feedbackRating, smsConsentConfirmed, device } = req.body;
    console.log('[SMS] Received device:', device, '| Customer:', customerName);
    const userEmail = req.session.userEmail;
    const feedbackScore = feedbackRating ? parseInt(feedbackRating) : null;
    const consentConfirmed = smsConsentConfirmed === 'true' || smsConsentConfirmed === true;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer name and phone number are required' 
      });
    }

    if (!consentConfirmed) {
      return res.status(400).json({
        success: false,
        error: 'SMS consent must be confirmed before sending messages',
        code: 'CONSENT_REQUIRED'
      });
    }

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in again.',
        code: 'EMAIL_REQUIRED'
      });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    const userId = userResult.rows[0].id;

    const settingsCheckResult = await pool.query(
      'SELECT business_name FROM user_settings WHERE user_email = $1',
      [userEmail]
    );
    const businessName = settingsCheckResult.rows[0]?.business_name || 'Our Store';

    const subscriptionCheckResult = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );
    const googleReviewLink = subscriptionCheckResult.rows[0]?.google_review_link;

    if (!googleReviewLink) {
      return res.status(400).json({
        success: false,
        error: 'Please go to Settings and configure your Google Review Link before sending messages.',
        code: 'ONBOARDING_INCOMPLETE',
        missingFields: {
          googleReviewLink: !googleReviewLink
        }
      });
    }

    let formattedPhone;
    try {
      formattedPhone = validateAndFormatPhone(customerPhone);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    await pool.query(`
      INSERT INTO subscriptions (email, subscription_status, plan, sms_quota, sms_sent)
      VALUES ($1, 'trial', 'free', 50, 0)
      ON CONFLICT (email) DO NOTHING
    `, [userEmail]);

    const isOptedOut = await checkOptOut(pool, formattedPhone);
    if (isOptedOut) {
      return res.status(400).json({
        success: false,
        error: 'This phone number has opted out of SMS messages.',
        code: 'OPTED_OUT'
      });
    }

    // SAFETY BRAKE: Prevent duplicate SMS within 1 hour (infinite loop protection)
    const recentSmsCheck = await pool.query(
      `SELECT id, created_at FROM messages 
       WHERE user_id = $1 AND customer_phone = $2 
       AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, formattedPhone]
    );
    if (recentSmsCheck.rows.length > 0) {
      const lastSentAt = new Date(recentSmsCheck.rows[0].created_at);
      const minutesAgo = Math.round((Date.now() - lastSentAt.getTime()) / 60000);
      console.log(`[SAFETY BRAKE] Blocked duplicate SMS to ${formattedPhone} - last sent ${minutesAgo} minutes ago`);
      return res.status(429).json({
        success: false,
        error: `A message was already sent to this number ${minutesAgo} minutes ago. Please wait at least 1 hour between messages to the same customer.`,
        code: 'DUPLICATE_SMS_BLOCKED'
      });
    }

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const feedbackToken = messageType === 'review' ? crypto.randomUUID() : null;
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    
    if (feedbackToken) {
      console.log(`📋 Generated Token for ${formattedPhone}:`, feedbackToken);
    }

    // Create or update customer FIRST to get the customer ID for tracking link
    let customerId = null;
    let trackingToken = null;
    const customerCheck = await pool.query(
      'SELECT id, tracking_token FROM customers WHERE user_id = $1 AND phone = $2',
      [userId, formattedPhone]
    );

    if (customerCheck.rows.length > 0) {
      customerId = customerCheck.rows[0].id;
      // Generate a new secure tracking token for each SMS send
      trackingToken = crypto.randomBytes(16).toString('hex');
      await pool.query(
        'UPDATE customers SET name = $1, device = $2, updated_at = CURRENT_TIMESTAMP, last_sms_sent_at = CURRENT_TIMESTAMP, link_clicked = FALSE, follow_up_sent = FALSE, tracking_token = $3 WHERE id = $4',
        [customerName, device || null, trackingToken, customerId]
      );
    } else {
      trackingToken = crypto.randomBytes(16).toString('hex');
      const newCustomer = await pool.query(
        'INSERT INTO customers (user_id, name, phone, device, last_sms_sent_at, link_clicked, follow_up_sent, tracking_token) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, FALSE, FALSE, $5) RETURNING id',
        [userId, customerName, formattedPhone, device || null, trackingToken]
      );
      customerId = newCustomer.rows[0].id;
    }
    
    // Build message with secure token-based tracking link
    let message = (additionalInfo || '').replace(/{business}/g, businessName);
    
    if (messageType === 'review') {
      // Use secure tracking token instead of predictable customer ID
      const trackingLink = `${appHost}/r/${trackingToken}`;
      message += `\n\n${trackingLink}\n\nReply STOP to opt out.`;
      console.log(`📱 Secure Tracking Link: ${trackingLink}`);
    } else {
      message += `\n\nReply STOP to opt out.`;
    }

    const messageOptions = {
      body: message,
      from: fromNumber,
      to: formattedPhone
    };

    if (req.file) {
      if (!isCloudinaryEnabled()) {
        return res.status(503).json({
          success: false,
          error: 'Photo uploads are currently unavailable. Please configure Cloudinary or send without a photo.',
          code: 'CLOUDINARY_NOT_CONFIGURED'
        });
      }
      
      const photoUrl = req.file.path || req.file.secure_url;
      if (!photoUrl) {
        return res.status(500).json({
          success: false,
          error: 'Failed to upload photo to cloud storage. Please try again.',
          code: 'UPLOAD_FAILED'
        });
      }
      
      messageOptions.mediaUrl = [photoUrl];
      console.log('Sending MMS with photo:', photoUrl);
    }

    const pgClient = await pool.connect();
    let result;
    
    try {
      await pgClient.query('BEGIN');
      
      const quotaLock = await pgClient.query(`
        SELECT subscription_status, sms_quota, sms_sent 
        FROM subscriptions 
        WHERE email = $1
        FOR UPDATE
      `, [userEmail]);

      if (quotaLock.rows.length === 0) {
        await pgClient.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          error: 'Failed to check subscription. Please try again.',
          code: 'SUBSCRIPTION_ERROR'
        });
      }

      const { subscription_status, sms_quota, sms_sent } = quotaLock.rows[0];

      if (subscription_status !== 'active' && subscription_status !== 'trial') {
        await pgClient.query('ROLLBACK');
        return res.status(402).json({
          success: false,
          error: 'Your subscription is inactive. Please subscribe in the Billing tab to continue sending SMS.',
          code: 'SUBSCRIPTION_INACTIVE'
        });
      }

      if (sms_sent >= sms_quota) {
        await pgClient.query('ROLLBACK');
        return res.status(402).json({
          success: false,
          error: `You've reached your SMS quota (${sms_sent}/${sms_quota} messages). Please upgrade your plan in the Billing tab.`,
          code: 'QUOTA_EXCEEDED',
          quota: sms_quota,
          used: sms_sent
        });
      }

      await pgClient.query(`
        UPDATE subscriptions 
        SET sms_sent = sms_sent + 1, updated_at = CURRENT_TIMESTAMP 
        WHERE email = $1
      `, [userEmail]);

      result = await client.messages.create(messageOptions);
      
      await pgClient.query('COMMIT');
      
      console.log(`✅ SMS sent successfully: ${result.sid} | Quota: ${sms_sent + 1}/${sms_quota} for ${userEmail}`);
      
    } catch (twilioError) {
      await pgClient.query('ROLLBACK');
      throw twilioError;
    } finally {
      pgClient.release();
    }

    let dbSaved = false;
    try {
      const followUpDueAt = messageType === 'review' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null;

      const photoPath = req.file ? (req.file.path || req.file.secure_url) : null;
      
      const insertResult = await pool.query(
        `INSERT INTO messages (user_id, customer_id, customer_name, customer_phone, message_type, review_link, additional_info, photo_path, twilio_sid, feedback_token, follow_up_due_at, review_status, user_email, sms_consent_confirmed) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          userId,
          customerId,
          customerName,
          formattedPhone,
          messageType,
          googleReviewLink || null,
          additionalInfo || null,
          photoPath,
          result.sid,
          feedbackToken,
          followUpDueAt,
          messageType === 'review' ? 'pending' : null,
          userEmail,
          consentConfirmed
        ]
      );
      
      const messageId = insertResult.rows[0].id;
      console.log(`✅ Message ID ${messageId} saved to DB with feedback_token: ${feedbackToken}`);
      dbSaved = true;
    } catch (dbError) {
      console.error('⚠️ Error saving to database (message sent successfully):', dbError);
    }

    res.json({ 
      success: true, 
      message: 'Review request sent successfully!',
      messageSid: result.sid,
      photoAttached: !!req.file,
      dbSaved: dbSaved
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send SMS' 
    });
  }
};

export const submitFeedback = (pool, getTwilioClient, getTwilioFromPhoneNumber) => async (req, res) => {
  try {
    const { token, rating } = req.body;

    if (!token || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Token and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const messageResult = await pool.query(
      'SELECT * FROM messages WHERE feedback_token = $1 AND message_type = \'review\'',
      [token]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired feedback link'
      });
    }

    const message = messageResult.rows[0];

    if (message.feedback_rating !== null) {
      return res.status(400).json({
        success: false,
        error: 'Feedback has already been submitted for this request'
      });
    }

    await pool.query(
      `UPDATE messages 
       SET feedback_rating = $1, 
           feedback_collected_at = CURRENT_TIMESTAMP,
           review_link_clicked_at = CASE 
             WHEN $1 >= 4 THEN CURRENT_TIMESTAMP
             ELSE review_link_clicked_at
           END,
           review_status = CASE 
             WHEN $1 >= 4 THEN 'link_clicked'
             ELSE 'reviewed'
           END
       WHERE id = $2`,
      [rating, message.id]
    );

    if (rating >= 4) {
      const userEmail = message.user_email;
      
      if (!userEmail) {
        console.error('❌ No user email found for message:', message.id);
        return res.status(500).json({
          success: true,
          message: 'Thank you for your feedback! (Unable to send review link - contact support)'
        });
      }

      const pgClient = await pool.connect();
      let twilioResult;
      
      try {
        await pgClient.query('BEGIN');
        
        const quotaLock = await pgClient.query(`
          SELECT subscription_status, sms_quota, sms_sent 
          FROM subscriptions 
          WHERE email = $1
          FOR UPDATE
        `, [userEmail]);

        if (quotaLock.rows.length === 0) {
          await pgClient.query('ROLLBACK');
          console.error('❌ No subscription found for email:', userEmail);
          throw new Error('Subscription not found');
        }

        const { subscription_status, sms_quota, sms_sent } = quotaLock.rows[0];

        if (subscription_status !== 'active' && subscription_status !== 'trial') {
          await pgClient.query('ROLLBACK');
          console.error('❌ Inactive subscription for:', userEmail);
          throw new Error('Subscription inactive');
        }

        if (sms_sent >= sms_quota) {
          await pgClient.query('ROLLBACK');
          console.error(`❌ Quota exceeded for ${userEmail}: ${sms_sent}/${sms_quota}`);
          throw new Error('SMS quota exceeded');
        }

        await pgClient.query(`
          UPDATE subscriptions 
          SET sms_sent = sms_sent + 1, updated_at = CURRENT_TIMESTAMP 
          WHERE email = $1
        `, [userEmail]);

        const isOptedOut = await checkOptOut(pool, message.customer_phone);
        if (isOptedOut) {
          await pgClient.query('ROLLBACK');
          return res.json({
            success: true,
            message: 'Thank you for your feedback! (Unable to send review link - customer has opted out)'
          });
        }

        const client = await getTwilioClient();
        const fromNumber = await getTwilioFromPhoneNumber();
        
        const reviewToken = crypto.randomBytes(3).toString('hex');
        const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
        const trackedReviewLink = `${appHost}/r/${reviewToken}`;
        
        const reviewMessage = `Thank you for your positive feedback! 🌟 We'd love if you could share your experience on Google: ${trackedReviewLink}\n\nReply STOP to opt out.`;

        twilioResult = await client.messages.create({
          body: reviewMessage,
          from: fromNumber,
          to: message.customer_phone
        });

        // Get user_id from authenticated user
        const userResult = await pgClient.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
        if (userResult.rows.length === 0) {
          throw new Error('User not found for email: ' + userEmail);
        }
        const userId = userResult.rows[0].id;

        await pgClient.query(
          `INSERT INTO messages (user_id, customer_id, customer_name, customer_phone, message_type, review_link, twilio_sid, review_link_token, user_email, review_status, follow_up_due_at) 
           VALUES ($1, $2, $3, $4, 'review_link', $5, $6, $7, $8, 'pending', CURRENT_TIMESTAMP + INTERVAL '3 days')`,
          [userId, message.customer_id, message.customer_name, message.customer_phone, message.review_link, twilioResult.sid, reviewToken, userEmail]
        );

        await pgClient.query('COMMIT');
        
        console.log(`✅ Google Review link sent to ${message.customer_name} (${message.customer_phone}) - Rating: ${rating} stars - SID: ${twilioResult.sid} | Quota: ${sms_sent + 1}/${sms_quota}`);

      } catch (twilioError) {
        await pgClient.query('ROLLBACK');
        console.error('❌ Error sending review link SMS:', twilioError);
        throw twilioError;
      } finally {
        pgClient.release();
      }
    } else {
      console.log(`ℹ️ Low rating (${rating} stars) from ${message.customer_name} - No review link sent`);
    }

    res.json({
      success: true,
      message: rating >= 4 ? 'Thank you! We sent you a Google Review link.' : 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback'
    });
  }
};

export const trackReviewClick = (pool) => async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await pool.query(
      'SELECT id, review_link, review_link_clicked_at FROM messages WHERE review_link_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Invalid review link');
    }
    
    const message = result.rows[0];
    
    if (!message.review_link_clicked_at) {
      await pool.query(
        `UPDATE messages 
         SET review_link_clicked_at = CURRENT_TIMESTAMP, review_status = 'link_clicked'
         WHERE id = $1`,
        [message.id]
      );
    }
    
    res.redirect(302, message.review_link);
  } catch (error) {
    console.error('Error tracking review link click:', error);
    res.status(500).send('Error processing review link');
  }
};

export const trackCustomerClick = (pool) => async (req, res) => {
  try {
    const { token } = req.params;
    
    // Use secure token lookup instead of predictable customer ID
    const result = await pool.query(
      `SELECT c.id, c.name, c.phone, c.user_id, s.google_review_link, us.business_name
       FROM customers c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN subscriptions s ON u.company_email = s.email
       LEFT JOIN user_settings us ON u.company_email = us.user_email
       WHERE c.tracking_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Invalid or expired link');
    }
    
    const customer = result.rows[0];
    
    // Track the click
    await pool.query(
      'UPDATE customers SET link_clicked = TRUE WHERE id = $1',
      [customer.id]
    );
    
    console.log(`📊 Link clicked by customer: ${customer.name} (Token: ${token.substring(0, 8)}...)`);
    
    // Show thank you transition page before redirecting to Google Review
    const googleLink = customer.google_review_link;
    const businessName = customer.business_name || 'our business';
    
    if (googleLink && googleLink.trim()) {
      console.log(`🌟 Showing Star Filter page for ${customer.name}`);
      
      const starFilterHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How Was Your Experience? - ${businessName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: #fff;
      text-align: center;
      padding: 20px;
    }
    .container {
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(20px);
      border-radius: 28px;
      padding: 48px 36px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .logo {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
    }
    .business-name {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 16px;
      color: rgba(255,255,255,0.75);
      margin-bottom: 32px;
    }
    .stars-container {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }
    .star-btn {
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      cursor: pointer;
      font-size: 28px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .star-btn:hover {
      background: rgba(255,255,255,0.2);
      transform: scale(1.1);
    }
    .star-btn.selected {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      border-color: #fbbf24;
      transform: scale(1.1);
    }
    .star-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      margin-top: 8px;
      padding: 0 4px;
    }
    
    /* Priority Resolution Form (1-3 stars) */
    .priority-form {
      display: none;
      text-align: left;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.15);
      animation: slideIn 0.4s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .priority-form.show { display: block; }
    .priority-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .priority-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .priority-text h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .priority-text p {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
    }
    .vip-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .form-textarea {
      width: 100%;
      min-height: 120px;
      padding: 14px;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 15px;
      resize: none;
      transition: border-color 0.2s;
    }
    .form-textarea:focus {
      outline: none;
      border-color: #a855f7;
    }
    .form-textarea::placeholder {
      color: rgba(255,255,255,0.4);
    }
    .submit-btn {
      width: 100%;
      margin-top: 16px;
      padding: 16px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      border: none;
      border-radius: 12px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .submit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);
    }
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .privacy-note {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      margin-top: 12px;
      text-align: center;
    }
    
    /* Awesome Screen (4-5 stars) */
    .awesome-screen {
      display: none;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1); }
    }
    .awesome-screen.show { display: block; }
    .awesome-icon {
      font-size: 80px;
      margin-bottom: 20px;
      animation: bounce 0.6s ease infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-10px); }
    }
    .awesome-title {
      font-size: 36px;
      font-weight: 800;
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
    }
    .awesome-subtitle {
      font-size: 16px;
      color: rgba(255,255,255,0.8);
    }
    
    /* Success Screen */
    .success-screen {
      display: none;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .success-screen.show { display: block; }
    .success-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 40px;
    }
    .success-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .success-subtitle {
      font-size: 16px;
      color: rgba(255,255,255,0.8);
    }
    
    /* Initial/Rating Screen */
    .rating-screen { display: block; }
    .rating-screen.hide { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Initial Rating Screen -->
    <div id="rating-screen" class="rating-screen">
      <div class="logo">⭐</div>
      <div class="business-name">${businessName}</div>
      <h1>How was your experience?</h1>
      <p class="subtitle">Your feedback helps us serve you better</p>
      
      <div class="stars-container">
        <button class="star-btn" data-rating="1">1</button>
        <button class="star-btn" data-rating="2">2</button>
        <button class="star-btn" data-rating="3">3</button>
        <button class="star-btn" data-rating="4">4</button>
        <button class="star-btn" data-rating="5">5</button>
      </div>
      <div class="star-labels">
        <span>Poor</span>
        <span>Excellent</span>
      </div>
      
      <!-- Priority Resolution Form (1-3 Stars) -->
      <div id="priority-form" class="priority-form">
        <div class="priority-header">
          <div class="priority-icon">🎯</div>
          <div class="priority-text">
            <h2>We want to make this right.</h2>
            <p>Message the owner directly so we can fix this immediately.</p>
          </div>
        </div>
        
        <div class="vip-badge">
          <span>👑</span> VIP Priority Resolution
        </div>
        
        <textarea id="feedback-text" class="form-textarea" placeholder="Tell us what happened and how we can make it right. The owner will personally review your message..."></textarea>
        
        <button id="submit-feedback" class="submit-btn">Send Direct Message to Owner</button>
        
        <p class="privacy-note">🔒 This goes directly to the owner - not posted publicly</p>
      </div>
    </div>
    
    <!-- Awesome Screen (4-5 Stars) -->
    <div id="awesome-screen" class="awesome-screen">
      <div class="awesome-icon">🎉</div>
      <h1 class="awesome-title">Awesome!</h1>
      <p class="awesome-subtitle">Thank you! Directing you to Google...</p>
    </div>
    
    <!-- Success Screen (After Feedback Submission) -->
    <div id="success-screen" class="success-screen">
      <div class="success-icon">✓</div>
      <h1 class="success-title">Message Received!</h1>
      <p class="success-subtitle">Thank you for reaching out. The owner will<br>review your message and get back to you soon.</p>
    </div>
  </div>
  
  <script>
    const token = '${token}';
    let selectedRating = 0;
    
    const starBtns = document.querySelectorAll('.star-btn');
    const ratingScreen = document.getElementById('rating-screen');
    const priorityForm = document.getElementById('priority-form');
    const awesomeScreen = document.getElementById('awesome-screen');
    const successScreen = document.getElementById('success-screen');
    const submitBtn = document.getElementById('submit-feedback');
    const feedbackText = document.getElementById('feedback-text');
    
    starBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        selectedRating = parseInt(this.dataset.rating);
        
        // Update star visual state
        starBtns.forEach((b, i) => {
          if (i < selectedRating) {
            b.classList.add('selected');
            b.textContent = '★';
          } else {
            b.classList.remove('selected');
            b.textContent = (i + 1).toString();
          }
        });
        
        // Route based on rating
        if (selectedRating >= 4) {
          // High rating: Show Awesome screen then auto-redirect to Google
          setTimeout(() => {
            ratingScreen.classList.add('hide');
            awesomeScreen.classList.add('show');
            // Auto-redirect to Google after 500ms
            setTimeout(() => {
              window.location.href = '${googleLink}';
            }, 500);
          }, 400);
        } else {
          // Low rating: Show Priority Resolution Form
          priorityForm.classList.add('show');
        }
      });
    });
    
    submitBtn.addEventListener('click', async function() {
      const text = feedbackText.value.trim();
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      
      try {
        const response = await fetch('/api/internal-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedbackToken: token,
            rating: selectedRating,
            feedbackText: text
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          ratingScreen.classList.add('hide');
          priorityForm.classList.remove('show');
          successScreen.classList.add('show');
        } else {
          alert('Something went wrong. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Direct Message to Owner';
        }
      } catch (err) {
        alert('Connection error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Direct Message to Owner';
      }
    });
  </script>
</body>
</html>`;
      
      res.send(starFilterHtml);
    } else {
      // Fallback: Show thank you page when Google link is not configured
      console.log(`⚠️ No Google Review link configured for user_id: ${customer.user_id}`);
      res.redirect(302, `/thank-you.html?business=${encodeURIComponent(businessName)}`);
    }
  } catch (error) {
    console.error('Error tracking customer click:', error);
    res.status(500).send('Error processing link');
  }
};

export const getCustomersNeedingFollowup = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT id, name, phone, last_sms_sent_at, created_at
       FROM customers 
       WHERE user_id = $1
         AND last_sms_sent_at IS NOT NULL
         AND link_clicked = FALSE
         AND follow_up_sent = FALSE
         AND last_sms_sent_at < NOW() - INTERVAL '24 hours'
       ORDER BY last_sms_sent_at ASC`,
      [userId]
    );
    
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error fetching customers needing follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const sendCustomerFollowups = (pool, getTwilioClient, getTwilioFromPhoneNumber) => async (req, res) => {
  try {
    const { customerIds } = req.body;
    const userEmail = req.session.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!customerIds || customerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No customers selected' });
    }

    if (customerIds.length > 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 customers at a time' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    
    let successCount = 0;
    let errors = [];
    
    for (const customerId of customerIds) {
      try {
        const custResult = await pool.query(
          'SELECT id, name, phone, tracking_token FROM customers WHERE id = $1 AND user_id = $2',
          [customerId, userId]
        );
        
        if (custResult.rows.length === 0) {
          errors.push({ customerId, error: 'Customer not found' });
          continue;
        }
        
        const customer = custResult.rows[0];
        
        const isOptedOut = await checkOptOut(pool, customer.phone);
        if (isOptedOut) {
          errors.push({ customerId, error: 'Phone has opted out' });
          continue;
        }
        
        // Use existing tracking token or generate new one
        let trackingToken = customer.tracking_token;
        if (!trackingToken) {
          trackingToken = crypto.randomBytes(16).toString('hex');
          await pool.query('UPDATE customers SET tracking_token = $1 WHERE id = $2', [trackingToken, customer.id]);
        }
        
        const trackingLink = `${appHost}/r/${trackingToken}`;
        const reminderMessage = `Hi ${customer.name}, just checking if you had a chance to rate your repair? It really helps us out! ${trackingLink}\n\nReply STOP to opt out.`;
        
        const result = await client.messages.create({
          body: reminderMessage,
          from: fromNumber,
          to: customer.phone
        });
        
        await pool.query(
          'UPDATE customers SET follow_up_sent = TRUE WHERE id = $1',
          [customer.id]
        );
        
        await pool.query(
          `INSERT INTO messages (user_id, customer_id, customer_name, customer_phone, message_type, twilio_sid, user_email)
           VALUES ($1, $2, $3, $4, 'follow_up_reminder', $5, $6)`,
          [userId, customer.id, customer.name, customer.phone, result.sid, userEmail]
        );
        
        successCount++;
        console.log(`✅ Follow-up sent to ${customer.name} (${customer.phone})`);
      } catch (error) {
        console.error(`Error sending follow-up to customer ${customerId}:`, error);
        errors.push({ customerId, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      sent: successCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending customer follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateReviewStatus = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const result = await pool.query(
      `UPDATE messages 
       SET review_received_at = CURRENT_TIMESTAMP, review_status = 'reviewed'
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Message not found or access denied' });
    }
    
    res.json({ success: true, message: 'Review marked as received' });
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMessagesNeedingFollowup = (pool) => async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, customer_name, customer_phone, sent_at, review_link, follow_up_due_at
       FROM messages 
       WHERE message_type = 'review'
         AND review_status = 'pending'
         AND review_link_clicked_at IS NULL
         AND follow_up_sent_at IS NULL
         AND follow_up_due_at <= CURRENT_TIMESTAMP
       ORDER BY sent_at ASC`
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Error fetching messages needing follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const sendFollowups = (pool, getTwilioClient, getTwilioFromPhoneNumber) => async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No message IDs provided' });
    }
    
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    
    let successCount = 0;
    let errors = [];
    
    for (const messageId of messageIds) {
      try {
        const msgResult = await pool.query(
          'SELECT customer_name, customer_phone, review_link_token FROM messages WHERE id = $1',
          [messageId]
        );
        
        if (msgResult.rows.length === 0) continue;
        
        const { customer_name, customer_phone, review_link_token } = msgResult.rows[0];
        
        const isOptedOut = await checkOptOut(pool, customer_phone);
        if (isOptedOut) {
          errors.push({ messageId, error: 'Phone number has opted out' });
          continue;
        }
        
        const trackedLink = `${appHost}/r/${review_link_token}`;
        
        const followUpMessage = `Hi ${customer_name}! Just a friendly reminder - we'd really appreciate your feedback on Google. Your review helps us serve you better! ${trackedLink} Thank you! 🙏\n\nReply STOP to opt out.`;
        
        const result = await client.messages.create({
          body: followUpMessage,
          from: fromNumber,
          to: customer_phone
        });
        
        const newMessageResult = await pool.query(
          `INSERT INTO messages (user_id, customer_id, customer_name, customer_phone, message_type, review_link, twilio_sid, follow_up_message_id, user_email)
           SELECT user_id, customer_id, customer_name, customer_phone, 'review_follow_up', review_link, $1, $2, user_email
           FROM messages WHERE id = $3
           RETURNING id`,
          [result.sid, messageId, messageId]
        );
        
        await pool.query(
          `UPDATE messages 
           SET follow_up_sent_at = CURRENT_TIMESTAMP, review_status = 'follow_up_sent'
           WHERE id = $1`,
          [messageId]
        );
        
        successCount++;
      } catch (error) {
        console.error(`Error sending follow-up for message ${messageId}:`, error);
        errors.push({ messageId, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      sent: successCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const handleIncomingSMS = (pool, validateAndFormatPhone) => async (req, res) => {
  try {
    const { From, Body } = req.body;
    
    if (!From || !Body) {
      return res.status(400).send('Invalid webhook data');
    }

    let formattedPhone;
    try {
      formattedPhone = validateAndFormatPhone(From);
    } catch (error) {
      console.error('Invalid phone number in webhook:', From);
      return res.status(200).send('OK');
    }

    const messageBody = Body.trim().toUpperCase();
    
    if (messageBody === 'STOP' || messageBody === 'STOPALL' || messageBody === 'UNSUBSCRIBE' || messageBody === 'CANCEL' || messageBody === 'END' || messageBody === 'QUIT') {
      await pool.query(
        `INSERT INTO sms_optouts (phone, reason)
         VALUES ($1, $2)
         ON CONFLICT (phone) DO NOTHING`,
        [formattedPhone, messageBody]
      );
      
      console.log(`✓ Phone number ${formattedPhone} opted out with keyword: ${messageBody}`);
      
      return res.status(200).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed from SMS messages. Reply START to opt back in.</Message>
</Response>`);
    }
    
    if (messageBody === 'START' || messageBody === 'UNSTOP' || messageBody === 'YES') {
      await pool.query(
        'DELETE FROM sms_optouts WHERE phone = $1',
        [formattedPhone]
      );
      
      console.log(`✓ Phone number ${formattedPhone} opted back in with keyword: ${messageBody}`);
      
      return res.status(200).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been re-subscribed to SMS messages. Reply STOP to opt out.</Message>
</Response>`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling incoming SMS:', error);
    res.status(200).send('OK');
  }
};

export const sendReminder = (pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone) => async (req, res) => {
  try {
    const { messageId, customerName, customerPhone, reviewLink } = req.body;
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!messageId || !customerName || !customerPhone || !reviewLink) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    const userId = userResult.rows[0].id;

    const settingsCheckResult = await pool.query(
      'SELECT business_name FROM user_settings WHERE user_email = $1',
      [userEmail]
    );
    const businessName = settingsCheckResult.rows[0]?.business_name || 'Our Store';

    let formattedPhone;
    try {
      formattedPhone = validateAndFormatPhone(customerPhone);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Please use 10-digit US format or E.164 international format (+1...)'
      });
    }

    const isOptedOut = await checkOptOut(pool, formattedPhone);
    if (isOptedOut) {
      return res.status(400).json({
        success: false,
        error: `${customerName} has opted out of SMS messages.`
      });
    }

    const reminderMessage = `Hi ${customerName}, just checking if you had a moment to leave us a review? It helps a lot! ${reviewLink}\n\nReply STOP to opt out`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the subscription row and check quota atomically
      const quotaLock = await client.query(
        `SELECT subscription_status, sms_quota, sms_sent 
         FROM subscriptions 
         WHERE email = $1 
         FOR UPDATE`,
        [userEmail]
      );

      if (quotaLock.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'No active subscription found. Please subscribe to a plan.'
        });
      }

      const { subscription_status, sms_quota, sms_sent } = quotaLock.rows[0];
      console.log(`[SEND REMINDER] Quota check (locked): sms_sent=${sms_sent}, sms_quota=${sms_quota}`);

      if (subscription_status !== 'active' && subscription_status !== 'trialing' && subscription_status !== 'trial') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'Your subscription is not active. Please update your billing.'
        });
      }

      if (sms_sent >= sms_quota) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: `SMS quota exceeded (${sms_sent}/${sms_quota}). Please upgrade your plan or wait for quota reset.`,
          code: 'QUOTA_EXCEEDED',
          quota: sms_quota,
          used: sms_sent
        });
      }

      // Send via Twilio (inside transaction to ensure quota is locked)
      console.log(`[SEND REMINDER] Sending reminder to ${customerName} at ${formattedPhone}`);
      const twilioClient = getTwilioClient();
      const fromNumber = getTwilioFromPhoneNumber();

      const result = await twilioClient.messages.create({
        from: fromNumber,
        to: formattedPhone,
        body: reminderMessage
      });

      // Increment quota with RETURNING for accurate post-update value
      const updateResult = await client.query(
        `UPDATE subscriptions 
         SET sms_sent = sms_sent + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE email = $1
         RETURNING sms_sent`,
        [userEmail]
      );
      const newSmsSent = updateResult.rows[0].sms_sent;

      await client.query(
        `INSERT INTO messages (user_id, customer_name, customer_phone, message_type, review_link, twilio_sid, user_email, follow_up_message_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, customerName, formattedPhone, 'reminder', reviewLink, result.sid, userEmail, messageId]
      );

      await client.query(
        `UPDATE messages 
         SET follow_up_sent_at = CURRENT_TIMESTAMP, review_status = 'reminder_sent'
         WHERE id = $1`,
        [messageId]
      );

      await client.query('COMMIT');

      console.log(`[SEND REMINDER] ✓ Reminder sent successfully to ${customerName} | sms_sent variable correctly used: ${newSmsSent}/${sms_quota}`);

      res.json({
        success: true,
        message: `Reminder sent to ${customerName}`
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send reminder'
    });
  }
};

export const checkSentStatus = (pool) => async (req, res) => {
  try {
    const { phoneNumbers } = req.body;
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.json({ success: true, sentStatus: {} });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT customer_phone, MAX(created_at) as last_sent
       FROM messages
       WHERE user_id = $1 
         AND customer_phone = ANY($2)
         AND message_type IN ('review', 'reactivation', 'reminder', 'apology')
       GROUP BY customer_phone`,
      [userId, phoneNumbers]
    );

    const sentStatus = {};
    const now = new Date();
    
    for (const row of result.rows) {
      const lastSent = new Date(row.last_sent);
      const diffMs = now - lastSent;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        sentStatus[row.customer_phone] = 'Today';
      } else if (diffDays === 1) {
        sentStatus[row.customer_phone] = '1d ago';
      } else {
        sentStatus[row.customer_phone] = `${diffDays}d ago`;
      }
    }

    res.json({ success: true, sentStatus });
  } catch (error) {
    console.error('Error checking sent status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
