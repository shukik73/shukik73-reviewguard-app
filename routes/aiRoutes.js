import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';

export default function createAIRoutes(pool) {
  const router = Router();

  router.post('/api/generate-reply', aiController.generateReply(pool));

  return router;
}
