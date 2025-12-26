import { Router } from 'express';
import * as repairDeskController from '../controllers/repairDeskController.js';

export default function createRepairDeskRoutes(requireAuth) {
  const router = Router();

  router.get('/api/repairdesk/tickets', requireAuth, repairDeskController.getRecentTickets);
  router.get('/api/check-sms-history/:phone', requireAuth, repairDeskController.checkSmsHistory);

  return router;
}
