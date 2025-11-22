import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { getOpenAI } from '../lib/openai.js';

export const processOCR = (pool) => async (req, res) => {
  console.log('=== OCR REQUEST RECEIVED ===');
  console.log('File:', req.file ? { fieldname: req.file.fieldname, size: req.file.size, mimetype: req.file.mimetype } : 'NO FILE');
  
  try {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    console.log('Processing file:', req.file.originalname, 'Size:', req.file.size);
    let imageBuffer = req.file.buffer;
    console.log('Buffer created, size:', imageBuffer.length);
    
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

    // Determine MIME type
    const mimeType = req.file.mimetype === 'image/heic' || req.file.mimetype === 'image/heif' 
      ? 'image/jpeg' 
      : req.file.mimetype;

    console.log('Sending to OpenAI GPT-4o Vision for OCR processing...');
    
    let openai;
    try {
      openai = getOpenAI();
      console.log('✅ OpenAI client initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize OpenAI:', err.message);
      console.error('   Environment check:');
      console.error('   - AI_INTEGRATIONS_OPENAI_API_KEY:', process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? '✓ set' : '✗ missing');
      console.error('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ set' : '✗ missing');
      throw err;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an Optical Character Recognition (OCR) expert for a Repair Shop POS system. Your goal is to extract: Customer Name, Phone Number, Device Model, and Repair Type.

RULES FOR ACCURACY:

Name: Look for the bold name at the very top or next to the "Customer Information" header. IGNORE text like "View More", "Edit", "Store Credits", or "Customer #".

Phone: Find the phone number (usually starts with +1).

Device: Look under headers like "Item Name", "Service Information", or "Labor/Service Details". Example: "iPhone 16 Pro Max", "HP Laptop".

Repair: Look for the service description. Example: "Screen Replacement", "Motherboard Replacement".

Return the result ONLY as a JSON object with NO additional text: { "name": "...", "phone": "...", "device": "...", "repair": "..." }

If you cannot find a field, use an empty string for that field.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const aiResponse = response.choices[0].message.content;
    console.log('=== OpenAI GPT-4o Response ===');
    console.log(aiResponse);
    console.log('================================');

    let customerName = '';
    let customerPhone = '';
    let device = '';
    let repair = '';

    try {
      // Extract JSON from the response (handle case where AI returns extra text)
      const jsonMatch = aiResponse.match(/\{[^{}]*"name"[^{}]*"phone"[^{}]*"device"[^{}]*"repair"[^{}]*\}/s);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        customerName = extracted.name || '';
        customerPhone = extracted.phone || '';
        device = extracted.device || '';
        repair = extracted.repair || '';
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // If parsing fails, return empty fields
    }

    // Normalize phone number if extracted
    if (customerPhone) {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      if (phoneDigits.length === 10) {
        customerPhone = '+1' + phoneDigits;
      } else if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
        customerPhone = '+' + phoneDigits;
      } else if (phoneDigits.length > 0) {
        customerPhone = '+' + phoneDigits;
      }
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
        repair
      }
    });
  } catch (error) {
    console.error('=== CRITICAL OCR ERROR ===');
    console.error('FULL ERROR:', error);
    console.error('OPENAI ERROR:', error.response ? error.response.data : 'No response data');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('============================');
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to process image';
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};
