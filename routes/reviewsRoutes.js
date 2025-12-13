import { Router } from 'express';
import * as reviewsController from '../controllers/reviewsController.js';
import { basicAuth } from '../middleware/security.js';

export default function createReviewsRoutes(pool, requireAuth) {
  const router = Router();

  router.post('/api/reviews/ingest', reviewsController.ingestReview(pool));
  router.get('/api/reviews', requireAuth, basicAuth, reviewsController.getReviews(pool));
  router.get('/api/reviews/stats', requireAuth, basicAuth, reviewsController.getReviewStats(pool));
  router.post('/api/reviews/update-draft', requireAuth, basicAuth, reviewsController.updateReviewDraft(pool));
  router.post('/api/reviews/post-reply', requireAuth, basicAuth, reviewsController.postReply(pool));
  router.post('/api/reviews/ignore', requireAuth, basicAuth, reviewsController.ignoreReview(pool));

  return router;
}
