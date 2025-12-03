import multer from 'multer';
import path from 'path';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { getCloudinary, isCloudinaryConfigured } from './cloudinary.js';

let storage;

if (isCloudinaryConfigured()) {
  const cloudinary = getCloudinary();
  
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'sms-manager-uploads',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
    }
  });
  
  console.log('✅ Multer configured with Cloudinary storage');
} else {
  storage = multer.memoryStorage();
  console.warn('⚠️  Multer using memory storage (Cloudinary not configured)');
}

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

export const ocrUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype) || /\.(heic|heif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and HEIC images are allowed.'));
    }
  }
});
