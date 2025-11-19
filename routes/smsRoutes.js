import { Router } from 'express';
import * as smsController from '../controllers/smsController.js';

export default function createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth) {
  const router = Router();

  router.post('/api/send-review-request', requireAuth, upload.single('photo'), smsController.sendReviewRequest(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload));
  router.post('/api/feedback/submit', smsController.submitFeedback(pool, getTwilioClient, getTwilioFromPhoneNumber));
  router.get('/r/:token', smsController.trackReviewClick(pool));
  router.patch('/api/messages/:id/review-status', smsController.updateReviewStatus(pool));
  router.get('/api/messages/needs-followup', smsController.getMessagesNeedingFollowup(pool));
  router.post('/api/follow-ups/send', smsController.sendFollowups(pool, getTwilioClient, getTwilioFromPhoneNumber));

  return router;
}
