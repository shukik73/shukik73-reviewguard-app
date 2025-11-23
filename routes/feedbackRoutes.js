import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';

export default function createFeedbackRoutes(pool, requireAuth) {
  const router = Router();

  router.post('/api/feedback/internal', feedbackController.submitInternalFeedback(pool));
  router.post('/api/feedback/public', feedbackController.submitPublicReview(pool));
  router.get('/api/feedback', requireAuth, feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', requireAuth, feedbackController.markFeedbackAsRead(pool));
  router.post('/api/track-link-click', feedbackController.trackLinkClick(pool));

  return router;
}
