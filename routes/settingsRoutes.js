import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import * as telegramController from '../controllers/telegramController.js';

export default function createSettingsRoutes(pool, requireAuth) {
  const router = Router();

  router.get('/api/settings', requireAuth, settingsController.getSettings(pool));
  router.post('/api/settings', requireAuth, settingsController.updateSettings(pool));

  router.get('/api/settings/telegram', requireAuth, telegramController.getTelegramConfig(pool));
  router.post('/api/settings/telegram', requireAuth, telegramController.saveTelegramConfig(pool));
  router.delete('/api/settings/telegram', requireAuth, telegramController.deleteTelegramConfig(pool));
  router.post('/api/settings/telegram/test', requireAuth, telegramController.testTelegramConnection(pool));

  return router;
}
