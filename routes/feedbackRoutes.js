import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';
import { createBasicAuth } from '../middleware/security.js';

export default function createFeedbackRoutes(pool, requireAuth) {
  const router = Router();
  const basicAuth = createBasicAuth(pool);

  router.post('/api/internal-feedback', feedbackController.submitInternalFeedback(pool));
  router.post('/api/public-review', feedbackController.submitPublicReview(pool));

  router.get('/api/feedback', requireAuth, basicAuth, feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', requireAuth, basicAuth, feedbackController.markFeedbackAsRead(pool));
  router.post('/api/feedback/block', requireAuth, basicAuth, feedbackController.blockFeedback(pool));

  return router;
}
