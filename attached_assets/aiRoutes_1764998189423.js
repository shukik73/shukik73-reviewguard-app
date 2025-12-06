import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';

export default function createAIRoutes(pool, requireAuth) {
  const router = Router();

  router.post('/api/generate-reply', aiController.generateReply(pool));
  router.post('/api/simulate-review', requireAuth, aiController.simulateReview(pool));

  return router;
}
