import { Router } from 'express';
import axios from 'axios';
import twilio from 'twilio';
import * as smsController from '../controllers/smsController.js';

export default function createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter) {
  const router = Router();
  
  const validateTwilioSignature = async (req, res, next) => {
    try {
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const skipValidation = process.env.SKIP_TWILIO_WEBHOOK_VALIDATION === 'true';
      
      if (!twilioAuthToken) {
        if (skipValidation) {
          console.warn('⚠️ TWILIO_AUTH_TOKEN not configured - webhook validation DISABLED (SKIP_TWILIO_WEBHOOK_VALIDATION=true)');
          return next();
        }
        console.error('❌ TWILIO_AUTH_TOKEN secret required for webhook security. Set SKIP_TWILIO_WEBHOOK_VALIDATION=true to bypass (not recommended for production).');
        return res.status(500).json({ error: 'Webhook validation not configured' });
      }
      
      const twilioSignature = req.headers['x-twilio-signature'];
      
      if (!twilioSignature) {
        console.warn('Missing Twilio signature header');
        return res.status(403).json({ error: 'Missing Twilio signature' });
      }
      
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;
      
      const isValid = twilio.validateRequest(twilioAuthToken, twilioSignature, url, req.body);
      
      if (!isValid) {
        console.warn('Invalid Twilio signature for URL:', url);
        return res.status(403).json({ error: 'Invalid Twilio signature' });
      }
      
      next();
    } catch (error) {
      console.error('Twilio signature validation error:', error);
      return res.status(500).json({ error: 'Webhook validation failed' });
    }
  };

  // Campaign launch endpoint - proxies to n8n webhook with deduplication
  router.post('/api/campaigns/launch', requireAuth, async (req, res) => {
    try {
      const n8nWebhookUrl = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
      if (!n8nWebhookUrl) {
        return res.status(500).json({ success: false, error: 'Campaign webhook URL not configured' });
      }

      const { campaign_name, message, numbers, campaign_id: clientCampaignId } = req.body;
      
      if (!campaign_name || !message || !numbers || numbers.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const userEmail = req.session.userEmail;
      const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
      if (userResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      const userId = userResult.rows[0].id;

      const campaignId = clientCampaignId || `${campaign_name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const duplicateCheck = await pool.query(
        'SELECT COUNT(*) as count FROM messages WHERE campaign_id = $1 AND user_id = $2',
        [campaignId, userId]
      );

      if (parseInt(duplicateCheck.rows[0].count) > 0) {
        console.warn(`⚠️ Duplicate campaign detected: ${campaignId} for user ${userId}`);
        return res.status(409).json({ 
          success: false, 
          error: 'Campaign already processed',
          campaign_id: campaignId 
        });
      }

      const response = await axios.post(n8nWebhookUrl, {
        campaign_name,
        campaign_id: campaignId,
        message,
        numbers,
        user_email: userEmail
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-n8n-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        timeout: 30000
      });

      console.log(`✅ Campaign "${campaign_name}" (${campaignId}) launched with ${numbers.length} recipients`);
      res.json({ success: true, campaign_id: campaignId, data: response.data });
    } catch (error) {
      console.error('Campaign launch error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/api/send-review-request', smsLimiter, requireAuth, upload.single('photo'), smsController.sendReviewRequest(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload));

  // Simple SMS endpoint for feedback responses (no review link, just direct SMS)
  router.post('/api/send-sms', smsLimiter, requireAuth, async (req, res) => {
    try {
      const { customerName, customerPhone, message, tcpaConsent } = req.body;
      const userEmail = req.session.userEmail;

      if (!customerName || !customerPhone || !message) {
        return res.status(400).json({ success: false, error: 'Customer name, phone, and message are required' });
      }

      if (!tcpaConsent) {
        return res.status(400).json({ success: false, error: 'SMS consent required', code: 'CONSENT_REQUIRED' });
      }

      if (!userEmail) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
      if (userResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      const userId = userResult.rows[0].id;

      let formattedPhone;
      try {
        formattedPhone = validateAndFormatPhone(customerPhone);
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      // Check opt-out status
      const optOutCheck = await pool.query(
        'SELECT 1 FROM sms_optouts WHERE phone = $1 AND user_id = $2',
        [formattedPhone, userId]
      );
      if (optOutCheck.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Customer has opted out of SMS messages' });
      }

      // Get Twilio client and send SMS
      const twilioClient = getTwilioClient();
      const fromNumber = getTwilioFromPhoneNumber();

      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: formattedPhone
      });

      // Log message to database
      await pool.query(
        `INSERT INTO messages (customer_name, customer_phone, message_type, message_text, user_id, tcpa_consent)
         VALUES ($1, $2, 'response', $3, $4, true)`,
        [customerName, formattedPhone, message, userId]
      );

      console.log(`✅ SMS sent to ${formattedPhone} (SID: ${twilioMessage.sid})`);
      res.json({ success: true, messageSid: twilioMessage.sid });
    } catch (error) {
      console.error('Send SMS error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Secure token-based tracking route (Smart Follow-up)
  router.get('/r/:token', smsController.trackCustomerClick(pool));
  router.post('/r/:token', smsController.handleNoJsRatingSubmission(pool));
  
  // Legacy token-based tracking (for old messages)
  router.get('/review/:token', smsController.trackReviewClick(pool));
  
  router.patch('/api/messages/:id/review-status', requireAuth, smsController.updateReviewStatus(pool));
  router.get('/api/messages/needs-followup', requireAuth, smsController.getMessagesNeedingFollowup(pool));
  router.post('/api/follow-ups/send', smsLimiter, requireAuth, smsController.sendFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));
  router.post('/api/send-reminder', smsLimiter, requireAuth, smsController.sendReminder(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone));
  router.post('/api/sms/webhook', validateTwilioSignature, smsController.handleIncomingSMS(pool, validateAndFormatPhone));
  
  // Smart Follow-up endpoints
  router.get('/api/customers/needs-followup', requireAuth, smsController.getCustomersNeedingFollowup(pool));
  router.post('/api/customers/send-followups', smsLimiter, requireAuth, smsController.sendCustomerFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));
  
  // Check sent status for campaign list
  router.post('/api/customers/sent-status', requireAuth, smsController.checkSentStatus(pool));

  return router;
}
