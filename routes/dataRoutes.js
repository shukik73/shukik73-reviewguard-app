import { Router } from 'express';
import * as dataController from '../controllers/dataController.js';
import { createBasicAuth } from '../middleware/security.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default function createDataRoutes(pool, requireAuth) {
  const router = Router();
  const basicAuth = createBasicAuth(pool);

  router.get('/api/messages', requireAuth, basicAuth, dataController.getMessages(pool));
  router.get('/api/customers', requireAuth, basicAuth, dataController.getCustomers(pool));
  router.get('/api/stats', requireAuth, basicAuth, dataController.getStats(pool));

  router.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT company_email FROM users WHERE id = $1', [req.session.userId]);
      if (!result.rows[0] || result.rows[0].company_email !== ADMIN_EMAIL) {
        return res.json({ success: false, error: 'Access denied' });
      }

      const users = await pool.query(
        'SELECT id, company_name, first_name, last_name, company_email, is_active, created_at FROM users ORDER BY created_at DESC'
      );
      res.json({ success: true, users: users.rows });
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.json({ success: false, error: 'Failed to load users' });
    }
  });

  router.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT company_email FROM users WHERE id = $1', [req.session.userId]);
      if (!result.rows[0] || result.rows[0].company_email !== ADMIN_EMAIL) {
        return res.json({ success: false, error: 'Access denied' });
      }

      const userIdToDelete = parseInt(req.params.id);
      if (userIdToDelete === req.session.userId) {
        return res.json({ success: false, error: 'Cannot delete yourself' });
      }

      await pool.query('DELETE FROM messages WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM customers WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM internal_feedback WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM telegram_configs WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM google_reviews WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM pending_reviews WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM auth_tokens WHERE user_id = $1', [userIdToDelete]);
      await pool.query('DELETE FROM users WHERE id = $1', [userIdToDelete]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.json({ success: false, error: 'Failed to delete user' });
    }
  });

  return router;
}
