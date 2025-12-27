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

console.log('OpenAI Key Loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, realpathSync } from 'fs';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './config/database.js';
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
import createRepairDeskRoutes from './routes/repairDeskRoutes.js';
import createReviewsRoutes from './routes/reviewsRoutes.js';
import { initializeTelegramBot } from './controllers/telegramController.js';
import requireAuth from './middleware/requireAuth.js';
import { createRateLimiters } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 5000;

let smsLimiter, apiLimiter;

app.set('trust proxy', 1);

app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "js.stripe.com", "code.jquery.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "https://us-assets.i.posthog.com", "https://us.i.posthog.com", "https://embed.tawk.to", "https://va.tawk.to", "https://static.tawk.link"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://static.tawk.link"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://us.i.posthog.com", "https://us-assets.i.posthog.com", "https://va.tawk.to", "wss://va.tawk.to"],
      frameSrc: ["'self'", "js.stripe.com", "https://tawk.to", "https://embed.tawk.to"],
      fontSrc: ["'self'", "data:", "https://static.tawk.link"],
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
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.BASE_URL, 
        'https://reviews.techymiramar.com',
        'https://getreviewguard.com',
        'https://www.getreviewguard.com'
      ].filter(Boolean)
    : true,
  credentials: true
};
app.use(cors(corsOptions));

// Performance logging middleware for API requests
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = duration > 500 ? '⚠️ SLOW' : '✓';
      console.log(`${logLevel} ${req.method} ${req.url} took ${duration}ms`);
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url.endsWith('.js') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Clear-Site-Data', '"cache", "storage"');
  }
  next();
});

// Root route - ALWAYS show landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Dashboard - protected route
app.get('/app', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Also add /dashboard as alias
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/app');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Signup page
app.get('/signup', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/app');
  }
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Forgot password page
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// Reset password page
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/uploads/:filename', (req, res) => {
  let filename;
  try {
    filename = decodeURIComponent(req.params.filename);
  } catch (e) {
    return res.status(403).send('Invalid filename encoding');
  }
  
  const safeFilenameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}[a-zA-Z0-9]\.(jpg|jpeg|png|gif|webp|pdf)$/i;
  if (!safeFilenameRegex.test(filename) || (filename.match(/\./g) || []).length !== 1) {
    return res.status(403).send('Invalid filename');
  }
  
  const safeFilename = path.basename(filename);
  const ext = path.extname(safeFilename).toLowerCase();
  
  let uploadsDir;
  try {
    uploadsDir = realpathSync(path.join(__dirname, 'uploads'));
  } catch (e) {
    return res.status(500).send('Server error');
  }
  
  const candidatePath = path.join(uploadsDir, safeFilename);
  
  if (!existsSync(candidatePath)) {
    return res.status(404).send('File not found');
  }
  
  let resolvedPath;
  try {
    resolvedPath = realpathSync(candidatePath);
    if (!resolvedPath.startsWith(uploadsDir + path.sep) && resolvedPath !== path.join(uploadsDir, safeFilename)) {
      return res.status(403).send('Invalid path');
    }
  } catch (e) {
    return res.status(404).send('File not found');
  }
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  
  if (ext === '.pdf') {
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  }
  
  res.sendFile(resolvedPath);
});
app.use(express.static(path.join(__dirname, 'public')));

async function startServer() {
  try {
    await initializeRedis();
    const limiters = createRateLimiters();
    smsLimiter = limiters.smsLimiter;
    apiLimiter = limiters.apiLimiter;

    app.use('/api', apiLimiter);

    app.use(createAuthRoutes(pool));
    app.use(createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter));
    app.use(createDataRoutes(pool, requireAuth));
    app.use(createOCRRoutes(pool, ocrUpload, requireAuth));
    app.use(createBillingRoutes(pool));
    app.use(createSettingsRoutes(pool, requireAuth));
    app.use(createFeedbackRoutes(pool, requireAuth));
    app.use(createAIRoutes(pool, requireAuth));
    app.use('/api', createTelegramRoutes(pool));
    app.use(createRepairDeskRoutes(requireAuth));
    app.use(createReviewsRoutes(pool, requireAuth));

    initializeTelegramBot(pool);
    
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🌐 Access the app at http://0.0.0.0:${PORT}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
