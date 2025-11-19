import sharp from 'sharp';
import axios from 'axios';
import heicConvert from 'heic-convert';

export const processOCR = (pool) => async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OCR service not configured'
      });
    }

    let imageBuffer = req.file.buffer;
    
    const isHeic = req.file.mimetype === 'image/heic' || 
                   req.file.mimetype === 'image/heif' ||
                   /\.(heic|heif)$/i.test(req.file.originalname);
    
    if (isHeic) {
      console.log('Converting HEIC to JPEG...');
      const jpegBuffer = await heicConvert({
        buffer: req.file.buffer,
        format: 'JPEG',
        quality: 0.9
      });
      imageBuffer = Buffer.from(jpegBuffer);
      console.log('HEIC conversion completed');
    }

    const preprocessedImage = await sharp(imageBuffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .sharpen()
      .toBuffer();

    const base64Image = preprocessedImage.toString('base64');

    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      }
    );

    const textAnnotations = visionResponse.data.responses?.[0]?.textAnnotations || [];
    
    if (textAnnotations.length === 0) {
      return res.json({
        success: true,
        data: {
          customerName: '',
          customerPhone: '',
          device: '',
          repair: '',
          rawText: ''
        }
      });
    }

    const rawText = textAnnotations[0]?.description || '';
    console.log('=== OCR RAW TEXT ===');
    console.log(rawText);
    console.log('===================');

    let customerName = '';
    let customerPhone = '';
    let device = '';
    let repair = '';

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const metadataKeywords = [
      'Customer #', 'Added on', 'Store Credits', 'Notifications', 'Email Alert', 'SMS Alert',
      'Estimates', 'Inquiries', 'Tickets', 'Invoice', 'Trade-In', 'Store Credits',
      'Select Store', 'Gift Card', 'Total', 'ID', 'Balance'
    ];

    const filteredLines = lines.filter(line => {
      if (line.includes('(') && line.includes(')')) return false;
      if (/^\d{4}-\d{2}-\d{2}/.test(line)) return false;
      if (/\$\d+\.?\d*/.test(line)) return false;
      if (metadataKeywords.some(keyword => line.includes(keyword))) return false;
      return true;
    });

    for (const line of filteredLines) {
      if (!customerName) {
        const words = line.split(/\s+/);
        if (words.length === 2 && words.every(w => /^[A-Z][a-z]+$/.test(w))) {
          customerName = line;
          continue;
        }
      }

      const phoneMatch = line.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch && !customerPhone) {
        customerPhone = phoneMatch[0].replace(/\D/g, '');
        continue;
      }

      const deviceKeywords = ['iPhone', 'iPad', 'Samsung', 'Galaxy', 'Google Pixel', 'OnePlus', 'Cellphone Repairs', 'Apple', 'Android'];
      if (deviceKeywords.some(keyword => line.includes(keyword)) && !device) {
        device = line;
      }

      const repairKeywords = ['Screen', 'Battery', 'Camera', 'Charging', 'Port', 'Replacement', 'Repair', 'Device Issue'];
      if (repairKeywords.some(keyword => line.includes(keyword)) && !repair) {
        repair = line;
      }
    }

    if (customerPhone && customerPhone.length === 10) {
      customerPhone = '+1' + customerPhone;
    } else if (customerPhone && customerPhone.length === 11 && customerPhone.startsWith('1')) {
      customerPhone = '+' + customerPhone;
    }

    const extractedData = {
      customerName,
      customerPhone,
      device,
      repair
    };
    
    console.log('Extracted Data:', extractedData);

    res.json({
      success: true,
      data: {
        customerName,
        customerPhone,
        device,
        repair,
        rawText
      }
    });
  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process image'
    });
  }
};
