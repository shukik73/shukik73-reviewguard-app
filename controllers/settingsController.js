export const getSettings = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const subscriptionResult = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );

    const settingsResult = await pool.query(
      'SELECT business_name, sms_template FROM user_settings WHERE user_email = $1',
      [userEmail]
    );

    const settings = {
      google_review_link: subscriptionResult.rows[0]?.google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review',
      business_name: settingsResult.rows[0]?.business_name || '',
      sms_template: settingsResult.rows[0]?.sms_template || 'Hi {name}, thanks for visiting {business}! Please review us here: {link}'
    };

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSettings = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    const { google_review_link, business_name, sms_template } = req.body;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    await pool.query(`
      UPDATE subscriptions 
      SET google_review_link = $1, updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
    `, [google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review', userEmail]);

    await pool.query(`
      INSERT INTO user_settings (user_email, business_name, sms_template, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_email) 
      DO UPDATE SET 
        business_name = EXCLUDED.business_name,
        sms_template = EXCLUDED.sms_template,
        updated_at = CURRENT_TIMESTAMP
    `, [
      userEmail,
      business_name || '',
      sms_template || 'Hi {name}, thanks for visiting {business}! Please review us here: {link}'
    ]);

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
