import { Router } from 'express';
import axios from 'axios';
import * as smsController from '../controllers/smsController.js';

export default function createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter) {
  const router = Router();

  // Campaign launch endpoint - proxies to n8n webhook
  router.post('/api/campaigns/launch', requireAuth, async (req, res) => {
    try {
      const n8nWebhookUrl = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
      if (!n8nWebhookUrl) {
        return res.status(500).json({ success: false, error: 'Campaign webhook URL not configured' });
      }

      const { campaign_name, message, numbers } = req.body;
      
      if (!campaign_name || !message || !numbers || numbers.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const response = await axios.post(n8nWebhookUrl, {
        campaign_name,
        message,
        numbers,
        user_email: req.session.userEmail
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-n8n-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        timeout: 30000
      });

      console.log(`✅ Campaign "${campaign_name}" launched with ${numbers.length} recipients`);
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('Campaign launch error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/api/send-review-request', smsLimiter, requireAuth, upload.single('photo'), smsController.sendReviewRequest(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload));
  
  // Secure token-based tracking route (Smart Follow-up)
  router.get('/r/:token', smsController.trackCustomerClick(pool));
  
  // Legacy token-based tracking (for old messages)
  router.get('/review/:token', smsController.trackReviewClick(pool));
  
  router.patch('/api/messages/:id/review-status', requireAuth, smsController.updateReviewStatus(pool));
  router.get('/api/messages/needs-followup', requireAuth, smsController.getMessagesNeedingFollowup(pool));
  router.post('/api/follow-ups/send', smsLimiter, requireAuth, smsController.sendFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));
  router.post('/api/send-reminder', smsLimiter, requireAuth, smsController.sendReminder(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone));
  router.post('/api/sms/webhook', smsController.handleIncomingSMS(pool, validateAndFormatPhone));
  
  // Smart Follow-up endpoints
  router.get('/api/customers/needs-followup', requireAuth, smsController.getCustomersNeedingFollowup(pool));
  router.post('/api/customers/send-followups', smsLimiter, requireAuth, smsController.sendCustomerFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));
  
  // Check sent status for campaign list
  router.post('/api/customers/sent-status', requireAuth, smsController.checkSentStatus(pool));

  return router;
}
