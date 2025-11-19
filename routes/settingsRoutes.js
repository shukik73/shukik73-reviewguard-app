import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';

export default function createSettingsRoutes(pool, requireAuth) {
  const router = Router();

  router.get('/api/settings', requireAuth, settingsController.getSettings(pool));
  router.post('/api/settings', requireAuth, settingsController.updateSettings(pool));

  return router;
}
