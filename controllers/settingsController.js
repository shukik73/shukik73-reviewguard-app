export const getSettings = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const result = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Settings not found. Please set up your subscription first.'
      });
    }

    res.json({
      success: true,
      settings: {
        google_review_link: result.rows[0].google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review'
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSettings = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    const { google_review_link } = req.body;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const result = await pool.query(`
      UPDATE subscriptions 
      SET google_review_link = $1, updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
      RETURNING *
    `, [google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review', userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found. Please set up your subscription first.'
      });
    }

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
