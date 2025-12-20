import { getOpenAI } from '../lib/openai.js';

function extractDeviceMentions(text) {
  const deviceBrands = [
    'iPhone', 'iPad', 'MacBook', 'iMac', 'Apple Watch', 'AirPods',
    'Samsung Galaxy', 'Samsung', 'Galaxy',
    'Google Pixel', 'Pixel',
    'Surface', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer',
    'Xbox', 'PlayStation', 'Nintendo Switch', 'Switch'
  ];
  
  const genericDevices = [
    'laptop', 'laptops', 'tablet', 'tablets', 'phone', 'phones',
    'computer', 'computers', 'PC', 'PCs', 'Mac', 'Macs',
    'Chromebook', 'Chromebooks', 'console', 'consoles'
  ];
  
  const hypotheticalPhrases = [
    'if you have', 'if you need', 'if your', 'when you have', 'when you need',
    'whether it\'s', 'whether its', 'any', 'every', 'all your', 'other',
    'recommend them for', 'recommend for', 'bring your', 'for any',
    'no matter what', 'whatever', 'whichever', 'highly recommend'
  ];
  
  const foundDevices = [];
  const allKeywords = [...deviceBrands, ...genericDevices];
  const textLower = text.toLowerCase();
  
  const boundaryWords = ['and', 'or', 'both', 'repair', 'fixed', 'repaired', 'broken', 'issue', 'problem', 'ready', 'done', 'finished', 'service', 'work', 'works', 'working', 'great', 'amazing', 'excellent', 'fast', 'quick', 'slow', 'bad', 'good', 'super', 'very', 'really', 'so', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'was', 'were', 'is', 'are', 'my', 'your', 'their', 'his', 'her', 'our', 'its', 'also', 'too', 'plus', 'as', 'well', 'today', 'yesterday', 'now', 'here', 'there', 'perfectly', 'perfectly!'];
  
  for (const keyword of allKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b(${escapedKeyword}(?:[\\s-]+[A-Za-z0-9.]+)*)`, 'gi');
    
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      let devicePhrase = match[1].trim();
      const matchIndex = match.index;
      
      const contextBefore = textLower.substring(Math.max(0, matchIndex - 30), matchIndex);
      const isHypothetical = hypotheticalPhrases.some(phrase => contextBefore.includes(phrase));
      
      if (isHypothetical) {
        continue;
      }
      
      const tokens = devicePhrase.split(/\s+/);
      let validTokens = [tokens[0]];
      
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenClean = token.replace(/[^A-Za-z0-9.]/g, '').toLowerCase();
        
        if (boundaryWords.includes(tokenClean)) {
          break;
        }
        
        if (/^[A-Za-z0-9.]+$/.test(token)) {
          validTokens.push(token);
        } else {
          break;
        }
      }
      
      devicePhrase = validTokens.join(' ').trim();
      devicePhrase = devicePhrase.replace(/[.,;:!?]+$/, '');
      
      if (devicePhrase && devicePhrase.length > 0) {
        foundDevices.push(devicePhrase);
      }
    }
  }
  
  const deduplicated = [];
  const sortedDevices = foundDevices.sort((a, b) => b.length - a.length);
  
  for (const device of sortedDevices) {
    const deviceLower = device.toLowerCase();
    let isDuplicate = false;
    
    for (const existing of deduplicated) {
      const existingLower = existing.toLowerCase();
      if (existingLower.includes(deviceLower) || deviceLower.includes(existingLower)) {
        if (existingLower.length >= deviceLower.length) {
          isDuplicate = true;
          break;
        } else {
          const index = deduplicated.indexOf(existing);
          deduplicated.splice(index, 1);
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(device);
    }
  }
  
  return deduplicated;
}

function validateDeviceRuleCompliance(reviewText, generatedReply) {
  const devicesInReview = extractDeviceMentions(reviewText);
  
  if (devicesInReview.length === 0) {
    return { 
      status: 'passed', 
      reason: 'No devices mentioned in review',
      devicesRequired: [],
      devicesMentioned: [],
      missingDevices: []
    };
  }
  
  const replyLower = generatedReply.toLowerCase();
  const mentionedDevices = devicesInReview.filter(device => 
    replyLower.includes(device.toLowerCase())
  );
  
  const missingDevices = devicesInReview.filter(device => 
    !replyLower.includes(device.toLowerCase())
  );
  
  if (mentionedDevices.length === 0 && devicesInReview.length >= 2) {
    console.log(`[AI REPLY] Device FAIL: Review mentions ${devicesInReview.length} device(s) but reply mentions ZERO. Devices: "${devicesInReview.join('", "')}"`);
    return { 
      status: 'failed',
      reason: `Device Rule Violation: Review mentions ${devicesInReview.length} device(s) but reply mentions none`,
      devicesRequired: devicesInReview,
      devicesMentioned: [],
      missingDevices: devicesInReview
    };
  }
  
  if (mentionedDevices.length < devicesInReview.length) {
    console.log(`[AI REPLY] Device warning: Review mentions ${devicesInReview.length} device(s), reply mentions ${mentionedDevices.length}. Missing: "${missingDevices.join('", "')}". Allowing anyway - AI uses context to determine relevance.`);
    return { 
      status: 'passed_with_warning',
      reason: `Device warning: Missing ${missingDevices.length} device(s), but AI determined they weren't the primary repair focus`,
      devicesRequired: devicesInReview,
      devicesMentioned: mentionedDevices,
      missingDevices: missingDevices
    };
  }
  
  return { 
    status: 'passed',
    reason: `Device rule satisfied - all ${devicesInReview.length} device(s) mentioned`,
    devicesRequired: devicesInReview,
    devicesMentioned: mentionedDevices,
    missingDevices: []
  };
}

export const processIncomingReview = async (pool, userId, reviewData, telegramSender) => {
  try {
    const { customerName, starRating, reviewText } = reviewData;

    console.log(`[AUTOPILOT] Processing review from ${customerName} (${starRating}⭐) for user ${userId}`);

    // Fetch business name from user settings
    const settingsResult = await pool.query(
      'SELECT us.business_name, u.company_email FROM user_settings us JOIN users u ON us.user_email = u.company_email WHERE u.id = $1',
      [userId]
    );
    const businessName = settingsResult.rows[0]?.business_name || 'Our Business';
    const supportEmail = settingsResult.rows[0]?.company_email ? `support@${settingsResult.rows[0].company_email.split('@')[1]}` : 'our support team';

    // Step 1: Generate AI reply using 10 Golden Rules
    const rating = parseInt(starRating);
    let systemPrompt;
    let userPrompt;

    if (rating <= 3) {
      systemPrompt = `You are a compassionate customer service manager for ${businessName}. Your goal is to genuinely apologize and offer resolution.

THE 10 GOLDEN RULES FOR NEGATIVE REVIEWS (1-3 STARS):
Rule 1 (NEGATIVE OVERRIDE): For 1-3 star reviews, IGNORE all SEO rules. Focus only on sincere apology.

Rule 2 (SENTIMENT ANALYSIS): Read the sentiment, not just the stars.
Example: A 3-star review says "Great repair, just a bit pricey."
WRONG response: "We are so sorry for your bad experience." (This tells Google it was negative)
RIGHT response: "Thanks for trusting us with the repair! We use premium OEM-grade parts to ensure it lasts, which reflects the quality."

Rule 3: Acknowledge their specific frustration
Rule 4: Take full responsibility
Rule 5: Ask them to contact ${supportEmail}
Rule 6: Keep it short (2-3 sentences max)
Rule 7: Be heartfelt and genuine
Rule 8: Do NOT mention devices or SEO keywords
Rule 9: Do NOT try to cross-sell or upsell
Rule 10: Do NOT deflect blame
Rule 11: End with a genuine apology`;
      
      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"

Write a sincere apology following the 10 Golden Rules for negative reviews. No SEO, just genuine care.`;
    } else {
      const devicesInReview = extractDeviceMentions(reviewText);
      const deviceHint = devicesInReview.length > 0 
        ? `\n\nDETECTED DEVICES IN REVIEW: ${devicesInReview.join(', ')} - YOU MUST MENTION AT LEAST ONE OF THESE IN YOUR REPLY!`
        : '';

      systemPrompt = `You are an expert Reputation Manager for ${businessName}. Your goal is to write replies that boost Local SEO while sounding natural and grateful.

This injects SEO keywords naturally.

THE 10 GOLDEN RULES FOR POSITIVE REVIEWS (4-5 STARS):
Rule 1 (SEO FOUNDATION): This injects SEO keywords naturally into your response.

Rule 2 (DEVICE MENTION): If the customer mentions ANY device (iPhone, iPad, MacBook, laptop, phone, tablet, console, computer, etc.), you MUST mention that EXACT device in your reply. This is non-negotiable for SEO.

Rule 3 (LOCATION): Naturally include "${businessName}" at least once. If the customer mentions a neighborhood or city, acknowledge it to extend the service area signal.

Rule 4 (GRATITUDE): Always thank them by name.

Rule 5 (NATURAL TONE): Sound warm and genuine, not robotic.

Rule 6 (BREVITY): Keep it concise (2-3 sentences max).

Rule 7 (PROFESSIONALISM): Maintain professional yet friendly tone.

Rule 8 (FUTURE FOCUS): Invite them back for future needs.

Rule 9 (CROSS-SELL): Occasionally mention other services naturally. Example: "We're here to help with any laptop, iPad, or phone repairs!"

Rule 10 (COMPLIANCE): Never violate Google's review response policies.

DANGER ZONES TO AVOID:
- Keyword stuffing (e.g., "Thanks for the phone repair, computer repair, tablet repair..." is SPAM)
- Generic responses that could apply to any business
- Overly long responses (keep under 3 sentences)`;

      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"${deviceHint}

Write a reply (2-3 sentences) following ALL rules above. Make it sound natural and grateful.`;
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const aiReply = completion.choices[0].message.content.trim();
    console.log(`[AUTOPILOT] AI Generated Reply: ${aiReply}`);

    // Step 2: Save to pending_reviews table with user_id for multi-tenancy
    const insertResult = await pool.query(
      `INSERT INTO pending_reviews (user_id, customer_name, star_rating, review_text, ai_proposed_reply, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [userId, customerName, starRating, reviewText, aiReply]
    );

    const reviewId = insertResult.rows[0].id;
    console.log(`[AUTOPILOT] Saved review to pending_reviews table (ID: ${reviewId}) for user ${userId}`);

    // Step 3: Send to Telegram for approval (user's own bot)
    if (telegramSender) {
      await telegramSender(userId, reviewId, reviewData, aiReply);
      console.log(`[AUTOPILOT] Sent approval request to Telegram for user ${userId}`);
    }

    return {
      success: true,
      reviewId,
      aiReply,
      message: 'Review processed and sent to Telegram for approval'
    };

  } catch (error) {
    console.error('[AUTOPILOT] Error processing review:', error);
    throw error;
  }
};

export const generateReply = (pool) => async (req, res) => {
  try {
    const { reviewText, customerName, starRating } = req.body;
    const userEmail = req.session?.userEmail;

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

    // Fetch business name from user settings
    let businessName = 'Our Business';
    let supportEmail = 'our support team';
    if (userEmail) {
      const settingsResult = await pool.query(
        'SELECT business_name FROM user_settings WHERE user_email = $1',
        [userEmail]
      );
      businessName = settingsResult.rows[0]?.business_name || 'Our Business';
      supportEmail = `support@${userEmail.split('@')[1]}`;
    }

    let systemPrompt;
    let userPrompt;

    if (rating <= 3) {
      systemPrompt = `You are a compassionate customer service manager for ${businessName}. Your goal is to genuinely apologize and offer resolution.

THE 10 GOLDEN RULES FOR NEGATIVE REVIEWS (1-3 STARS):
Rule 1 (NEGATIVE OVERRIDE): For 1-3 star reviews, IGNORE all SEO rules. Focus only on sincere apology.

Rule 2 (SENTIMENT ANALYSIS): Read the sentiment, not just the stars.
Example: A 3-star review says "Great repair, just a bit pricey."
WRONG response: "We are so sorry for your bad experience." (This tells Google it was negative)
RIGHT response: "Thanks for trusting us with the repair! We use premium OEM-grade parts to ensure it lasts, which reflects the quality."

Rule 3: Acknowledge their specific frustration
Rule 4: Take full responsibility
Rule 5: Ask them to contact ${supportEmail}
Rule 6: Keep it short (2-3 sentences max)
Rule 7: Be heartfelt and genuine
Rule 8: Do NOT mention devices or SEO keywords
Rule 9: Do NOT try to cross-sell or upsell
Rule 10: Do NOT deflect blame
Rule 11: End with a genuine apology`;
      
      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"

Write a sincere apology following the 10 Golden Rules for negative reviews. No SEO, just genuine care.`;
    } else {
      const devicesInReview = extractDeviceMentions(reviewText);
      const deviceHint = devicesInReview.length > 0 
        ? `\n\nDETECTED DEVICES IN REVIEW: ${devicesInReview.join(', ')} - YOU MUST MENTION AT LEAST ONE OF THESE IN YOUR REPLY!`
        : '';

      systemPrompt = `You are an expert Reputation Manager for ${businessName}. Your goal is to write replies that boost Local SEO while sounding natural and grateful.

This injects SEO keywords naturally.

THE 10 GOLDEN RULES FOR POSITIVE REVIEWS (4-5 STARS):
Rule 1 (SEO FOUNDATION): This injects SEO keywords naturally into your response.

Rule 2 (DEVICE MENTION): If the customer mentions ANY device (iPhone, iPad, MacBook, laptop, phone, tablet, console, computer, etc.), you MUST mention that EXACT device in your reply. This is non-negotiable for SEO.

Rule 3 (LOCATION): Naturally include "${businessName}" at least once. If the customer mentions a neighborhood or city, acknowledge it to extend the service area signal.

Rule 4 (GRATITUDE): Always thank them by name.

Rule 5 (NATURAL TONE): Sound warm and genuine, not robotic.

Rule 6 (BREVITY): Keep it concise (2-3 sentences max).

Rule 7 (PROFESSIONALISM): Maintain professional yet friendly tone.

Rule 8 (FUTURE FOCUS): Invite them back for future needs.

Rule 9 (CROSS-SELL): Occasionally mention other services naturally. Example: "We're here to help with any laptop, iPad, or phone repairs!"

Rule 10 (COMPLIANCE): Never violate Google's review response policies.

DANGER ZONES TO AVOID:
- Keyword stuffing (e.g., "Thanks for the phone repair, computer repair, tablet repair..." is SPAM)
- Generic responses that could apply to any business
- Overly long responses (keep under 3 sentences)`;

      userPrompt = `A customer named ${customerName} left a ${rating}-star review:

"${reviewText}"${deviceHint}

Write a reply (2-3 sentences) following ALL rules above. Make it sound natural and grateful.`;
    }

    const openai = getOpenAI();
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

    // Run device validation (lenient - logs warnings but never blocks)
    const deviceValidation = validateDeviceRuleCompliance(reviewText, generatedReply);
    
    if (deviceValidation.status === 'failed') {
      console.warn(`[AI REPLY] ${deviceValidation.reason}`);
    } else if (deviceValidation.status === 'passed_with_warning') {
      console.log(`[AI REPLY] ${deviceValidation.reason}`);
    }

    res.json({
      success: true,
      reply: generatedReply,
      metadata: {
        rating,
        customerName,
        deviceValidation
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

export const simulateReview = (pool) => async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { name, rating, text } = req.body;

    if (!name || !rating || !text) {
      return res.status(400).json({
        success: false,
        error: 'name, rating, and text are required'
      });
    }

    const reviewData = {
      customerName: name,
      starRating: parseInt(rating),
      reviewText: text
    };

    console.log(`[SIMULATE REVIEW] Received for user ${userId}:`, reviewData);

    const { sendApprovalRequest } = await import('./telegramController.js');

    const result = await processIncomingReview(pool, userId, reviewData, sendApprovalRequest);

    res.json({
      success: true,
      message: 'Review processed successfully',
      data: result
    });

  } catch (error) {
    console.error('[SIMULATE REVIEW] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process review'
    });
  }
};
