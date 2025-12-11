import { Router } from 'express';
import * as reviewsController from '../controllers/reviewsController.js';

export default function createReviewsRoutes(pool, requireAuth) {
  const router = Router();

  router.post('/api/reviews/ingest', reviewsController.ingestReview(pool));
  router.get('/api/reviews', requireAuth, reviewsController.getReviews(pool));
  router.get('/api/reviews/stats', requireAuth, reviewsController.getReviewStats(pool));
  router.post('/api/reviews/update-draft', requireAuth, reviewsController.updateReviewDraft(pool));
  router.post('/api/reviews/post-reply', requireAuth, reviewsController.postReply(pool));
  router.post('/api/reviews/ignore', requireAuth, reviewsController.ignoreReview(pool));

  return router;
}
