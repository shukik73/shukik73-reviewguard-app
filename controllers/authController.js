import bcrypt from 'bcrypt';
import crypto from 'crypto';
import Stripe from 'stripe';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/resend.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const signup = (pool) => async (req, res) => {
  try {
    const {
      companyName,
      firstName,
      lastName,
      email,
      password,
      billingStreet,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      subscriptionOption
    } = req.body;

    if (!companyName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Company name, first name, last name, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please try logging in instead.'
      });
    }

    const existingSubscription = await pool.query(
      'SELECT email FROM subscriptions WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingSubscription.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'This email is already registered. Please try logging in or use a different email address.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let subscriptionStatus = 'trial';
    let plan = 'free';
    let smsQuota = 50;
    let stripeCustomerId = null;
    let stripeSubscriptionId = null;

    if (subscriptionOption && subscriptionOption !== 'trial') {
      try {
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name: `${firstName} ${lastName}`,
          metadata: {
            company_name: companyName
          },
          address: {
            line1: billingStreet || '',
            city: billingCity || '',
            state: billingState || '',
            postal_code: billingZip || '',
            country: billingCountry || 'US'
          }
        });

        stripeCustomerId = customer.id;

        const priceId = subscriptionOption === 'starter' 
          ? process.env.STRIPE_PRICE_ID_STARTER 
          : process.env.STRIPE_PRICE_ID_PRO;

        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent']
        });

        stripeSubscriptionId = subscription.id;
        subscriptionStatus = subscription.status;
        plan = subscriptionOption;
        smsQuota = subscriptionOption === 'starter' ? 500 : 2000;
      } catch (stripeError) {
        console.error('Stripe error during signup:', stripeError);
        return res.status(500).json({
          success: false,
          error: 'Payment setup failed. Please try again or select the free trial option.'
        });
      }
    }

    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (
          company_name, first_name, last_name, company_email, password_hash,
          billing_address_street, billing_address_city, billing_address_state,
          billing_address_zip, billing_address_country
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, company_name, first_name, last_name, company_email`,
        [
          companyName, firstName, lastName, email.toLowerCase(), passwordHash,
          billingStreet || null, billingCity || null, billingState || null,
          billingZip || null, billingCountry || 'USA'
        ]
      );

      user = userResult.rows[0];

      await client.query(
        `INSERT INTO subscriptions (
          user_id, email, stripe_customer_id, stripe_subscription_id,
          subscription_status, plan, sms_quota, sms_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
        [user.id, email.toLowerCase(), stripeCustomerId, stripeSubscriptionId, subscriptionStatus, plan, smsQuota]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    if (subscriptionStatus !== 'trial') {
      try {
        await sendWelcomeEmail(email, firstName, plan);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    req.session.userId = user.id;
    req.session.userEmail = user.company_email;
    req.session.companyName = user.company_name;

    res.json({
      success: true,
      user: {
        id: user.id,
        companyName: user.company_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.company_email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    
    let errorMessage = 'Failed to create account. Please try again.';
    
    if (error.code === '23505') {
      if (error.constraint === 'users_company_email_key' || error.constraint === 'subscriptions_email_key') {
        errorMessage = 'This email is already registered. Please try logging in or use a different email address.';
      } else {
        errorMessage = 'A record with this information already exists.';
      }
    } else if (error.message && error.message.includes('password')) {
      errorMessage = 'Password requirements not met. Please use at least 8 characters.';
    } else if (error.message) {
      errorMessage = `Signup failed: ${error.message}`;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const login = (pool) => async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const userResult = await pool.query(
      'SELECT id, company_name, first_name, last_name, company_email, password_hash, is_active FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.company_email;
    req.session.companyName = user.company_name;

    res.json({
      success: true,
      user: {
        id: user.id,
        companyName: user.company_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.company_email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
    res.json({ success: true });
  });
};

export const getSession = (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        companyName: req.session.companyName
      }
    });
  } else {
    res.json({ authenticated: false });
  }
};

export const forgotPassword = (pool) => async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const userResult = await pool.query(
      'SELECT id, company_name, company_email, is_active FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    await pool.query(
      'DELETE FROM auth_tokens WHERE user_id = $1 AND token_type = $2',
      [user.id, 'password_reset']
    );

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    await pool.query(
      'INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, resetToken, 'password_reset', expiresAt]
    );

    const resetUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/reset-password.html?token=${resetToken}`;
    console.log(`\n🔑 PASSWORD RESET LINK FOR ${user.company_email}:`);
    console.log(`${resetUrl}`);
    console.log(`This link expires in 1 hour.\n`);

    await sendPasswordResetEmail(user.company_email, resetToken, user.company_name);

    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request. Please try again.'
    });
  }
};

export const verifyResetToken = (pool) => async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const tokenResult = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used, u.company_email, u.company_name 
       FROM auth_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1 AND t.token_type = $2`,
      [token, 'password_reset']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password reset token'
      });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has already been used'
      });
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has expired'
      });
    }

    res.json({
      success: true,
      email: tokenData.company_email,
      companyName: tokenData.company_name
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify reset token'
    });
  }
};

export const resetPassword = (pool) => async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const tokenResult = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used 
       FROM auth_tokens t
       WHERE t.token = $1 AND t.token_type = $2`,
      [token, 'password_reset']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password reset token'
      });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has already been used'
      });
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has expired'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, tokenData.user_id]
      );

      await client.query(
        'UPDATE auth_tokens SET used = TRUE WHERE id = $1',
        [tokenData.id]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
};
