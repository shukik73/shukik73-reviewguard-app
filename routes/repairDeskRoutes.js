import { Router } from 'express';
import * as repairDeskController from '../controllers/repairDeskController.js';

export default function createRepairDeskRoutes(requireAuth) {
  const router = Router();

  router.get('/api/repairdesk/tickets', requireAuth, repairDeskController.getRecentTickets);

  return router;
}
