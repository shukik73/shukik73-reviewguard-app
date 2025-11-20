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
import createAuthRoutes from './routes/authRoutes.js';
import createSMSRoutes from './routes/smsRoutes.js';
import createDataRoutes from './routes/dataRoutes.js';
import createOCRRoutes from './routes/ocrRoutes.js';
import createBillingRoutes from './routes/billingRoutes.js';
import createSettingsRoutes from './routes/settingsRoutes.js';
import requireAuth from './middleware/requireAuth.js';
import { smsLimiter, apiLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 5000;

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(session({
  store: new (connectPgSimple(session))({ pool, tableName: 'user_sessions', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }
}));

app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
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
app.use('/api', apiLimiter);

app.use(createAuthRoutes(pool));
app.use(createSMSRoutes(pool, getTwilioClient, getTwilioFromPhoneNumber, validateAndFormatPhone, upload, requireAuth, smsLimiter));
app.use(createDataRoutes(pool));
app.use(createOCRRoutes(pool, ocrUpload));
app.use(createBillingRoutes(pool));
app.use(createSettingsRoutes(pool, requireAuth));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
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
