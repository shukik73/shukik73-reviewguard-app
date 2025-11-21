import crypto from 'crypto';

async function checkOptOut(pool, phone) {
  const result = await pool.query(
    'SELECT id FROM sms_optouts WHERE phone = $1',
    [phone]
  );
  return result.rows.length > 0;
}

export const sendReviewRequest = (pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload) => async (req, res) => {
  try {
    const { customerName, customerPhone, messageType, additionalInfo, feedbackRating, smsConsentConfirmed } = req.body;
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
    const businessName = settingsCheckResult.rows[0]?.business_name;

    const subscriptionCheckResult = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );
    const googleReviewLink = subscriptionCheckResult.rows[0]?.google_review_link;

    if (!businessName || !googleReviewLink) {
      return res.status(400).json({
        success: false,
        error: 'Please go to Settings and configure your Business Name and Google Review Link before sending messages.',
        code: 'ONBOARDING_INCOMPLETE',
        missingFields: {
          businessName: !businessName,
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

    const settingsResult = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );
    
    const googleReviewLink = settingsResult.rows[0]?.google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review';

    const isOptedOut = await checkOptOut(pool, formattedPhone);
    if (isOptedOut) {
      return res.status(400).json({
        success: false,
        error: 'This phone number has opted out of SMS messages.',
        code: 'OPTED_OUT'
      });
    }

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const feedbackToken = messageType === 'review' ? crypto.randomBytes(8).toString('hex') : null;
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    
    let message = additionalInfo || '';
    
    if (messageType === 'review' && feedbackToken) {
      const feedbackLink = `${appHost}/feedback.html?token=${feedbackToken}`;
      message += `\n\n${feedbackLink}\n\nReply STOP to opt out.`;
    } else {
      message += `\n\nReply STOP to opt out.`;
    }

    const messageOptions = {
      body: message,
      from: fromNumber,
      to: formattedPhone
    };

    if (req.file) {
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      messageOptions.mediaUrl = [publicUrl];
      console.log('Sending MMS with photo:', publicUrl);
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
      let customerId = null;
      const customerCheck = await pool.query(
        'SELECT id FROM customers WHERE user_id = $1 AND phone = $2',
        [userId, formattedPhone]
      );

      if (customerCheck.rows.length > 0) {
        customerId = customerCheck.rows[0].id;
        await pool.query(
          'UPDATE customers SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [customerName, customerId]
        );
      } else {
        const newCustomer = await pool.query(
          'INSERT INTO customers (user_id, name, phone) VALUES ($1, $2, $3) RETURNING id',
          [userId, customerName, formattedPhone]
        );
        customerId = newCustomer.rows[0].id;
      }

      const followUpDueAt = messageType === 'review' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null;

      await pool.query(
        `INSERT INTO messages (user_id, customer_id, customer_name, customer_phone, message_type, review_link, additional_info, photo_path, twilio_sid, feedback_token, follow_up_due_at, review_status, user_email, sms_consent_confirmed) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          customerId,
          customerName,
          formattedPhone,
          messageType,
          googleReviewLink || null,
          additionalInfo || null,
          req.file ? req.file.filename : null,
          result.sid,
          feedbackToken,
          followUpDueAt,
          messageType === 'review' ? 'pending' : null,
          userEmail,
          consentConfirmed
        ]
      );
      
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

        await pgClient.query(
          `INSERT INTO messages (customer_id, customer_name, customer_phone, message_type, review_link, twilio_sid, review_link_token, user_email, review_status, follow_up_due_at) 
           VALUES ($1, $2, $3, 'review_link', $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP + INTERVAL '3 days')`,
          [message.customer_id, message.customer_name, message.customer_phone, message.review_link, twilioResult.sid, reviewToken, userEmail]
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

export const updateReviewStatus = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE messages 
       SET review_received_at = CURRENT_TIMESTAMP, review_status = 'reviewed'
       WHERE id = $1`,
      [id]
    );
    
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
          `INSERT INTO messages (customer_id, customer_name, customer_phone, message_type, review_link, twilio_sid, follow_up_message_id)
           SELECT customer_id, customer_name, customer_phone, 'review_follow_up', review_link, $1, $2
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
