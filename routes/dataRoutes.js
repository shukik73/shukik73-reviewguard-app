import { Router } from 'express';
import * as dataController from '../controllers/dataController.js';

export default function createDataRoutes(pool) {
  const router = Router();

  router.get('/api/messages', dataController.getMessages(pool));
  router.get('/api/customers', dataController.getCustomers(pool));
  router.get('/api/stats', dataController.getStats(pool));

  return router;
}
