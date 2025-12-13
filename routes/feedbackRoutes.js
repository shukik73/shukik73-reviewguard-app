import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';
import { basicAuth } from '../middleware/security.js';

export default function createFeedbackRoutes(pool, requireAuth) {
  const router = Router();

  router.get('/api/feedback', requireAuth, basicAuth, feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', requireAuth, basicAuth, feedbackController.markFeedbackAsRead(pool));

  return router;
}
