if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL ERROR: DATABASE_URL environment variable is not set.');
  console.error('   Please configure your database connection string.');
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error('❌ FATAL ERROR: SESSION_SECRET environment variable is not set.');
  console.error('   Please set a secure session secret for production use.');
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.warn('⚠️  WARNING: SESSION_SECRET is shorter than 32 characters.');
  console.warn('   For production use, please use a longer, cryptographically secure secret.');
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ FATAL ERROR: OPENAI_API_KEY is not set in Secrets.');
  console.error('   Please add OPENAI_API_KEY to your Replit Secrets with your OpenAI API key.');
  process.exit(1);
}

console.log('OpenAI Key Loaded:', process.env.OPENAI_API_KEY ? 'Yes (Starts with ' + process.env.OPENAI_API_KEY.substring(0, 5) + ')' : 'No');

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool, initializeDatabase } from './config/database.js';
import { getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone } from './utils/twilio.js';
import { upload, ocrUpload } from './utils/multerConfig.js';
import { initializeRedis } from './utils/redis.js';
import createAuthRoutes from './routes/authRoutes.js';
import createSMSRoutes from './routes/smsRoutes.js';
import createDataRoutes from './routes/dataRoutes.js';
import createOCRRoutes from './routes/ocrRoutes.js';
import createBillingRoutes from './routes/billingRoutes.js';
import createSettingsRoutes from './routes/settingsRoutes.js';
import createFeedbackRoutes from './routes/feedbackRoutes.js';
import createAIRoutes from './routes/aiRoutes.js';
import { createTelegramRoutes } from './routes/telegramRoutes.js';
import { initializeTelegramBot } from './controllers/telegramController.js';
import requireAuth from './middleware/requireAuth.js';
import { createRateLimiters } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 5000;

let smsLimiter, apiLimiter;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "js.stripe.com", "cdn.tailwindcss.com", "code.jquery.com", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'", "js.stripe.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(session({
  store: new (connectPgSimple(session))({ pool, tableName: 'user_sessions', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }
}));

app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url.endsWith('.js') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initializeRedis();
    const limiters = createRateLimiters();
    smsLimiter = limiters.smsLimiter;
    apiLimiter = limiters.apiLimiter;

    app.use('/api', apiLimiter);

    app.use(createAuthRoutes(pool));
    app.use(createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter));
    app.use(createDataRoutes(pool));
    app.use(createOCRRoutes(pool, ocrUpload));
    app.use(createBillingRoutes(pool));
    app.use(createSettingsRoutes(pool, requireAuth));
    app.use(createFeedbackRoutes(pool, requireAuth));
    app.use(createAIRoutes(pool, requireAuth));
    app.use('/api', createTelegramRoutes(pool));

    await initializeDatabase();
    initializeTelegramBot(pool);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Access the app at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
