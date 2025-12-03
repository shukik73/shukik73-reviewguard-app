import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let isConfigured = false;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
  isConfigured = true;
  console.log('✅ Cloudinary configured successfully');
} else {
  console.warn('⚠️  Cloudinary credentials not found. Photo uploads will fail.');
  console.warn('   Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
}

export const getCloudinary = () => cloudinary;
export const isCloudinaryConfigured = () => isConfigured;
export default cloudinary;
