import { Router } from 'express';
import * as smsController from '../controllers/smsController.js';

export default function createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter) {
  const router = Router();

  router.post('/api/send-review-request', smsLimiter, requireAuth, upload.single('photo'), smsController.sendReviewRequest(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload));
  
  // Secure token-based tracking route (Smart Follow-up)
  router.get('/r/:token', smsController.trackCustomerClick(pool));
  
  // Legacy token-based tracking (for old messages)
  router.get('/review/:token', smsController.trackReviewClick(pool));
  
  router.patch('/api/messages/:id/review-status', smsController.updateReviewStatus(pool));
  router.get('/api/messages/needs-followup', requireAuth, smsController.getMessagesNeedingFollowup(pool));
  router.post('/api/follow-ups/send', smsLimiter, smsController.sendFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));
  router.post('/api/send-reminder', smsLimiter, requireAuth, smsController.sendReminder(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone));
  router.post('/api/sms/webhook', smsController.handleIncomingSMS(pool, validateAndFormatPhone));
  
  // Smart Follow-up endpoints
  router.get('/api/customers/needs-followup', requireAuth, smsController.getCustomersNeedingFollowup(pool));
  router.post('/api/customers/send-followups', smsLimiter, requireAuth, smsController.sendCustomerFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));

  return router;
}
