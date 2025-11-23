import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';

export default function createFeedbackRoutes(pool) {
  const router = Router();

  router.post('/api/feedback/internal', feedbackController.submitInternalFeedback(pool));
  router.post('/api/feedback/public', feedbackController.submitPublicReview(pool));
  router.get('/api/feedback', feedbackController.getFeedback(pool));
  router.post('/api/feedback/mark-read', feedbackController.markFeedbackAsRead(pool));

  return router;
}
