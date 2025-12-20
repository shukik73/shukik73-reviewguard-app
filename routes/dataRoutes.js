import { Router } from 'express';
import * as dataController from '../controllers/dataController.js';
import { createBasicAuth } from '../middleware/security.js';

export default function createDataRoutes(pool, requireAuth) {
  const router = Router();
  const basicAuth = createBasicAuth(pool);

  router.get('/api/messages', requireAuth, basicAuth, dataController.getMessages(pool));
  router.get('/api/customers', requireAuth, basicAuth, dataController.getCustomers(pool));
  router.get('/api/stats', requireAuth, basicAuth, dataController.getStats(pool));

  return router;
}
