import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';

export default function createFeedbackRoutes(pool, requireAuth) {
  const router = Router();

  router.get('/api/feedback', requireAuth, feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', requireAuth, feedbackController.markFeedbackAsRead(pool));

  return router;
}
