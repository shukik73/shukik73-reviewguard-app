import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function extractDeviceMentions(text) {
  const devicePatterns = [
    /\b(iPhones?(?:\s+\d+(?:\s+(?:Pro|Plus|Max|Mini|SE))?)?)\b/gi,
    /\b(iPads?(?:\s+(?:Pro|Air|Mini))?(?:\s+\d+(?:th)?)?)\b/gi,
    /\b(MacBooks?(?:\s+(?:Pro|Air))?(?:\s+\d+)?)\b/gi,
    /\b(Apple\s+Watches?(?:\s+Series\s+\d+)?)\b/gi,
    /\b(AirPods?(?:\s+(?:Pro|Max))?)\b/gi,
    /\b(iMacs?(?:\s+(?:Pro))?(?:\s+\d+)?)\b/gi,
    /\b(Samsung\s+(?:Galaxy\s+)?(?:S\d+|Note\s+\d+|A\d+|Z\s+(?:Fold|Flip)\s*\d*))\b/gi,
    /\b(Google\s+Pixel(?:\s+\d+(?:\s+(?:Pro|XL))?)?)\b/gi,
    /\b(Surface(?:\s+(?:Pro|Laptop|Book|Go)\s*\d*)?)\b/gi,
    /\b(Chromebooks?)\b/gi,
    /\b(laptops?)\b/gi,
    /\b(tablets?)\b/gi,
    /\b(computers?)\b/gi,
    /\b(PCs?)\b/gi,
    /\b(Macs?)\b/gi,
    /\b(phones?)\b/gi,
    /\b((?:gaming\s+)?consoles?)\b/gi,
    /\b(Xbox(?:\s+(?:Series\s+)?[XS])?)\b/gi,
    /\b(PlayStation(?:\s+\d+)?)\b/gi,
    /\b(Nintendo\s+Switch)\b/gi,
  ];
  
  const foundDevices = [];
  const seenLower = new Set();
  
  for (const pattern of devicePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const device = match[1];
      const deviceLower = device.toLowerCase();
      
      if (!seenLower.has(deviceLower)) {
        foundDevices.push(device);
        seenLower.add(deviceLower);
      }
    }
  }
  
  return foundDevices;
}

function validateDeviceRuleCompliance(reviewText, generatedReply) {
  const devicesInReview = extractDeviceMentions(reviewText);
  
  if (devicesInReview.length === 0) {
    return { 
      status: 'passed', 
      reason: 'No devices mentioned in review',
      devicesRequired: [],
      devicesMentioned: []
    };
  }
  
  const replyLower = generatedReply.toLowerCase();
  const mentionedDevices = devicesInReview.filter(device => 
    replyLower.includes(device.toLowerCase())
  );
  
  if (mentionedDevices.length === 0) {
    return { 
      status: 'failed',
      reason: `Device Rule Violation: Review mentions "${devicesInReview.join('", "')}" but reply does not mention any device`,
      devicesRequired: devicesInReview,
      devicesMentioned: []
    };
  }
  
  return { 
    status: 'passed',
    reason: 'Device rule satisfied',
    devicesRequired: devicesInReview,
    devicesMentioned: mentionedDevices
  };
}

export const generateReply = (pool) => async (req, res) => {
  try {
    const { reviewText, customerName, starRating } = req.body;

    if (!reviewText || !customerName || starRating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'reviewText, customerName, and starRating are required'
      });
    }

    const rating = parseInt(starRating);

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'starRating must be between 1 and 5'
      });
    }

    let systemPrompt;
    let userPrompt;

    if (rating <= 3) {
      systemPrompt = `You are a compassionate customer service manager for Techy Miramar, a repair shop in Miramar, Florida. Your goal is to genuinely apologize and offer resolution.

THE 10 GOLDEN RULES FOR NEGATIVE REVIEWS (1-3 STARS):
Rule 1 (NEGATIVE OVERRIDE): For 1-3 star reviews, IGNORE all SEO rules. Focus only on sincere apology.
Rule 2: Acknowledge their specific frustration
Rule 3: Take full responsibility
Rule 4: Ask them to email support@techymiramar.com
Rule 5: Keep it short (2-3 sentences max)
Rule 6: Be heartfelt and genuine
Rule 7: Do NOT mention devices or SEO keywords
Rule 8: Do NOT try to cross-sell or upsell
Rule 9: Do NOT deflect blame
Rule 10: End with a genuine apology`;
      
      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"

Write a sincere apology following the 10 Golden Rules for negative reviews. No SEO, just genuine care.`;
    } else {
      const devicesInReview = extractDeviceMentions(reviewText);
      const deviceHint = devicesInReview.length > 0 
        ? `\n\nDETECTED DEVICES IN REVIEW: ${devicesInReview.join(', ')} - YOU MUST MENTION AT LEAST ONE OF THESE IN YOUR REPLY!`
        : '';

      systemPrompt = `You are an expert Reputation Manager for Techy Miramar, a repair shop in Miramar, Florida. Your goal is to write replies that boost Local SEO while sounding natural and grateful.

THE 10 GOLDEN RULES FOR POSITIVE REVIEWS (4-5 STARS):
Rule 1 (DEVICE RULE - MANDATORY): If the customer mentions ANY device (iPhone, iPad, MacBook, laptop, phone, tablet, console, computer, etc.), you MUST mention that EXACT device in your reply. This is non-negotiable for SEO. Example: "We're so glad we could fix your iPhone 13!"

Rule 2 (CROSS-SELL): Occasionally mention other services naturally. Example: "We're here to help with any laptop, iPad, or phone repairs!"

Rule 3 (LOCATION): Naturally include "Techy Miramar" or "here in Miramar" at least once.

Rule 4 (GRATITUDE): Always thank them by name.

Rule 5 (NATURAL TONE): Sound warm and genuine, not robotic.

Rule 6 (SPECIFICITY): Reference specific details from their review when possible.

Rule 7 (BREVITY): Keep it concise (2-3 sentences max).

Rule 8 (PROFESSIONALISM): Maintain professional yet friendly tone.

Rule 9 (FUTURE FOCUS): Invite them back for future needs.

Rule 10 (COMPLIANCE): Never violate Google's review response policies.`;

      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"${deviceHint}

Write a reply (2-3 sentences) following ALL 10 Golden Rules above. Make it sound natural and grateful.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const generatedReply = completion.choices[0].message.content.trim();

    let validation = null;
    
    if (rating >= 4) {
      validation = validateDeviceRuleCompliance(reviewText, generatedReply);
      
      if (validation.status === 'failed') {
        console.warn('Device Rule Violation Detected:', validation);
        return res.status(500).json({
          success: false,
          error: 'AI failed to follow the device rule. Please try generating again or manually edit the response.',
          validation: {
            status: validation.status,
            reason: validation.reason,
            devicesRequired: validation.devicesRequired,
            devicesMentioned: validation.devicesMentioned
          }
        });
      }
    }

    res.json({
      success: true,
      reply: generatedReply,
      metadata: {
        rating,
        deviceRuleApplied: rating >= 4,
        devicesDetected: rating >= 4 ? extractDeviceMentions(reviewText) : []
      },
      validation: validation || {
        status: 'not_applicable',
        reason: 'Device rule only applies to 4-5 star reviews'
      }
    });
  } catch (error) {
    console.error('Error generating AI reply:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again in a moment.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate reply. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
