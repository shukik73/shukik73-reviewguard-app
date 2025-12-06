import express from 'express';
import { testTelegramApproval } from '../controllers/telegramController.js';

export const createTelegramRoutes = (pool) => {
  const router = express.Router();

  router.post('/test-telegram', testTelegramApproval(pool));

  return router;
};
