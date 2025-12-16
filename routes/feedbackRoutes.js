import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';
import { basicAuth } from '../middleware/security.js';

export default function createFeedbackRoutes(pool, requireAuth) {
  const router = Router();

  // Public endpoints (no auth required - used by customers)
  router.post('/api/internal-feedback', feedbackController.submitInternalFeedback(pool));
  router.post('/api/public-review', feedbackController.submitPublicReview(pool));

  // Protected endpoints (require authentication)
  router.get('/api/feedback', requireAuth, basicAuth, feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', requireAuth, basicAuth, feedbackController.markFeedbackAsRead(pool));
  router.post('/api/feedback/block', requireAuth, basicAuth, feedbackController.blockFeedback(pool));

  return router;
}
