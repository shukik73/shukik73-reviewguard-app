import { Router } from 'express';
import * as authController from '../controllers/authController.js';

export default function createAuthRoutes(pool) {
  const router = Router();

  router.post('/api/auth/signup', authController.signup(pool));
  router.post('/api/auth/login', authController.login(pool));
  router.post('/api/auth/logout', authController.logout);
  router.get('/api/auth/session', authController.getSession);
  router.get('/api/auth/me', authController.getMe(pool));
  router.post('/api/auth/forgot-password', authController.forgotPassword(pool));
  router.get('/api/auth/verify-reset-token', authController.verifyResetToken(pool));
  router.post('/api/auth/reset-password', authController.resetPassword(pool));

  return router;
}
