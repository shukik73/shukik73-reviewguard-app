import Stripe from 'stripe';
import { sendWelcomeEmail, sendPaymentFailedEmail } from '../lib/resend.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = (pool) => async (req, res) => {
  try {
    const { email, planId } = req.body;
    
    if (!email || !planId) {
      return res.status(400).json({ error: 'Email and planId are required' });
    }

    const validPlans = {
      starter: {
        priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter',
        quota: 300,
        name: 'starter'
      },
      pro: {
        priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
        quota: 1000,
        name: 'pro'
      }
    };

    const plan = validPlans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: plan.priceId,
        quantity: 1,
      }],
      success_url: `${req.protocol}://${req.get('host')}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/`,
      customer_email: email,
      metadata: {
        email: email,
        planId: planId,
        smsQuota: plan.quota
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createPortalSession = (pool) => async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const subscription = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE email = $1',
      [email]
    );

    if (subscription.rows.length === 0 || !subscription.rows[0].stripe_customer_id) {
      return res.status(404).json({ 
        error: 'No subscription found. Please subscribe first.' 
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.rows[0].stripe_customer_id,
      return_url: `${req.protocol}://${req.get('host')}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPricing = (req, res) => {
  const plans = {
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter',
      amount: 4900,
      currency: 'usd',
      interval: 'month',
      smsQuota: 300,
      features: [
        '300 SMS per month',
        'Review tracking',
        'Automatic follow-ups',
        'Customer database',
        'OCR text extraction'
      ]
    },
    pro: {
      id: 'pro',
      name: 'Pro Plan',
      priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
      amount: 9900,
      currency: 'usd',
      interval: 'month',
      smsQuota: 1000,
      features: [
        '1,000 SMS per month',
        'Review tracking',
        'Automatic follow-ups',
        'Customer database',
        'OCR text extraction',
        'Priority support'
      ]
    }
  };
  
  res.json({ plans });
};

export const handleStripeWebhook = (pool) => async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_email || session.metadata?.email;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;
        const planId = session.metadata?.planId || 'starter';
        const smsQuota = parseInt(session.metadata?.smsQuota || '300');

        await pool.query(`
          INSERT INTO subscriptions (email, stripe_customer_id, stripe_subscription_id, subscription_status, plan, sms_quota)
          VALUES ($1, $2, $3, 'active', $4, $5)
          ON CONFLICT (email) 
          DO UPDATE SET 
            stripe_customer_id = $2,
            stripe_subscription_id = $3,
            subscription_status = 'active',
            plan = $4,
            sms_quota = $5,
            updated_at = CURRENT_TIMESTAMP
        `, [email, stripeCustomerId, stripeSubscriptionId, planId, smsQuota]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, email, status)
          VALUES ($1, $2, $3, $4)
        `, ['checkout_completed', event.data.object, email, 'success']);
        
        sendWelcomeEmail(email, planId).catch(err => 
          console.error('Failed to send welcome email:', err)
        );
        
        console.log(`✅ Subscription activated for ${email} - Plan: ${planId}, Quota: ${smsQuota}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status === 'active' ? 'active' : 'inactive';
        
        await pool.query(`
          UPDATE subscriptions 
          SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = $2
        `, [status, subscription.id]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, ['subscription_updated', event.data.object, 'success']);
        
        console.log(`✅ Subscription updated: ${subscription.id} -> ${status}`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id || subscription.subscription;
        
        await pool.query(`
          UPDATE subscriptions 
          SET subscription_status = 'inactive', updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = $1
        `, [subscriptionId]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, [event.type, event.data.object, 'success']);

        if (event.type === 'invoice.payment_failed') {
          const subscriptionData = await pool.query(
            'SELECT email FROM subscriptions WHERE stripe_subscription_id = $1',
            [subscriptionId]
          );
          if (subscriptionData.rows.length > 0) {
            sendPaymentFailedEmail(subscriptionData.rows[0].email).catch(err => 
              console.error('Failed to send payment failed email:', err)
            );
          }
        }
        
        console.log(`✅ Subscription deactivated: ${subscriptionId} - Reason: ${event.type}`);
        break;
      }

      default:
        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, [event.type, event.data.object, 'unhandled']);
        console.log(`⚠️ Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    await pool.query(`
      INSERT INTO event_logs (event_type, event_data, status, error_message)
      VALUES ($1, $2, $3, $4)
    `, [event.type, event.data?.object || {}, 'error', error.message]);
    
    res.status(500).json({ error: error.message });
  }
};

export const getSubscriptionStatus = (pool) => async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query(
      'SELECT subscription_status, plan, sms_quota, sms_sent FROM subscriptions WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        subscription_status: 'none',
        plan: 'free',
        sms_quota: 50,
        sms_sent: 0,
        usage_percentage: 0,
        warning_level: 'none'
      });
    }

    const { subscription_status, plan, sms_quota, sms_sent } = result.rows[0];
    const usagePercentage = (sms_sent / sms_quota) * 100;
    
    let warningLevel = 'none';
    if (usagePercentage >= 90) {
      warningLevel = 'critical';
    } else if (usagePercentage >= 80) {
      warningLevel = 'high';
    } else if (usagePercentage >= 70) {
      warningLevel = 'medium';
    }

    res.json({
      subscription_status,
      plan,
      sms_quota,
      sms_sent,
      usage_percentage: Math.round(usagePercentage),
      warning_level: warningLevel
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: error.message });
  }
};
