import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import twilio from 'twilio';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF) and PDFs are allowed'));
    }
  }
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

let connectionSettings;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

function validateAndFormatPhone(phone) {
  const hasInternationalPrefix = phone.trim().startsWith('+') || phone.trim().startsWith('00') || phone.trim().startsWith('011');
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('011')) {
    cleaned = cleaned.substring(3);
  }
  
  if (!hasInternationalPrefix && cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }
  
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned;
  }
  
  throw new Error('Invalid phone number format. Please use international format with country code (e.g., +1234567890 or 1234567890 for US)');
}

app.post('/api/send-review-request', upload.single('photo'), async (req, res) => {
  try {
    const { customerName, customerPhone, googleReviewLink, additionalInfo } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer name and phone number are required' 
      });
    }

    let formattedPhone;
    try {
      formattedPhone = validateAndFormatPhone(customerPhone);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();

    let message = `Hi ${customerName}! Thank you for choosing our repair service. We hope you're satisfied with the work we did.`;
    
    if (additionalInfo) {
      message += ` ${additionalInfo}`;
    }
    
    message += ` Could you take a moment to share your experience with a Google review? ${googleReviewLink || 'Your feedback means a lot to us!'} 🙏`;

    const messageOptions = {
      body: message,
      from: fromNumber,
      to: formattedPhone
    };

    if (req.file) {
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      messageOptions.mediaUrl = [publicUrl];
      console.log('Sending MMS with photo:', publicUrl);
    }

    const result = await client.messages.create(messageOptions);

    console.log('SMS sent successfully:', result.sid);

    res.json({ 
      success: true, 
      message: 'Review request sent successfully!',
      messageSid: result.sid,
      photoAttached: !!req.file
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send SMS' 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Access the app at http://0.0.0.0:${PORT}`);
});
