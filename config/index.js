const deriveBaseUrl = () => {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
};

const baseUrl = deriveBaseUrl();

export default {
  baseUrl,
  apiUrl: process.env.API_URL || `${baseUrl}/api`,
  appName: process.env.APP_NAME || 'ReviewGuard',
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  
  database: {
    url: process.env.DATABASE_URL
  }
};
