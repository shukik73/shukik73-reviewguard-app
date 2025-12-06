import { Router } from 'express';
import express from 'express';
import * as billingController from '../controllers/billingController.js';

export default function createBillingRoutes(pool) {
  const router = Router();

  router.post('/api/create-checkout-session', billingController.createCheckoutSession(pool));
  router.post('/api/create-portal-session', billingController.createPortalSession(pool));
  router.get('/api/pricing', billingController.getPricing);
  router.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), billingController.handleStripeWebhook(pool));
  router.get('/api/subscription-status', billingController.getSubscriptionStatus(pool));

  return router;
}
