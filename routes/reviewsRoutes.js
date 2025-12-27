import { Router } from 'express';
import * as reviewsController from '../controllers/reviewsController.js';
import { createBasicAuth } from '../middleware/security.js';

export default function createReviewsRoutes(pool, requireAuth) {
  const router = Router();
  const basicAuth = createBasicAuth(pool);

  router.post('/api/reviews/ingest', reviewsController.ingestReview(pool));
  router.get('/api/reviews', requireAuth, basicAuth, reviewsController.getReviews(pool));
  router.get('/api/reviews/stats', requireAuth, basicAuth, reviewsController.getReviewStats(pool));
  router.get('/api/reviews/pending-count', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) FROM google_reviews 
         WHERE user_id = $1 AND status = 'pending'`,
        [req.session.userId]
      );
      res.json({ count: parseInt(result.rows[0].count) || 0 });
    } catch (error) {
      console.error('Pending reviews count error:', error);
      res.json({ count: 0 });
    }
  });
  router.post('/api/reviews/update-draft', requireAuth, basicAuth, reviewsController.updateReviewDraft(pool));
  router.post('/api/reviews/post-reply', requireAuth, basicAuth, reviewsController.postReply(pool));
  router.post('/api/reviews/ignore', requireAuth, basicAuth, reviewsController.ignoreReview(pool));

  return router;
}
