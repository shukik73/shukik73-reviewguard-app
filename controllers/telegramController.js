import TelegramBot from 'node-telegram-bot-api';

let bot;
let chatId;
let pool;

export const initializeTelegramBot = (dbPool) => {
  pool = dbPool;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not found in environment. Telegram features disabled.');
    return;
  }

  if (!chatId) {
    console.warn('⚠️  TELEGRAM_CHAT_ID not found in environment. Telegram features disabled.');
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    console.log('✅ Telegram bot initialized in polling mode');

    bot.on('message', async (msg) => {
      const incomingChatId = msg.chat.id;
      const text = msg.text || '';

      if (text.trim().toUpperCase() === 'YES') {
        console.log('[TELEGRAM] YES command received - posting review');
        
        try {
          // Find the latest pending review
          const result = await pool.query(
            `SELECT id, customer_name, star_rating, ai_proposed_reply 
             FROM pending_reviews 
             WHERE status = 'pending' 
             ORDER BY created_at DESC 
             LIMIT 1`
          );

          if (result.rows.length === 0) {
            await bot.sendMessage(incomingChatId, '❌ No pending reviews found.');
            return;
          }

          const review = result.rows[0];

          // Update status to 'posted'
          await pool.query(
            `UPDATE pending_reviews 
             SET status = 'posted' 
             WHERE id = $1`,
            [review.id]
          );

          await bot.sendMessage(incomingChatId, `✅ Reply Posted to Google! (Simulated)\n\n📝 Review ID: ${review.id}\n👤 Customer: ${review.customer_name}\n⭐ Rating: ${review.star_rating} stars`);
          console.log(`[TELEGRAM] ✅ Review ${review.id} marked as posted`);

        } catch (error) {
          console.error('[TELEGRAM] Error processing YES command:', error);
          await bot.sendMessage(incomingChatId, '❌ Error posting review. Please try again.');
        }
      } else {
        await bot.sendMessage(incomingChatId, '❌ Edit mode not supported yet. Please log in to Dashboard.');
      }
    });

    bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error.message);
    });
  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error.message);
  }
};

export const sendApprovalRequest = async (reviewId, reviewData, aiReply) => {
  if (!bot || !chatId) {
    throw new Error('Telegram bot not initialized. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Secrets.');
  }

  const { customerName, starRating, reviewText } = reviewData;

  const stars = '⭐'.repeat(starRating);

  const message = `🚨 New Review!

👤 ${customerName} rated ${stars} ${starRating} star${starRating !== 1 ? 's' : ''}

💬 "${reviewText}"

🤖 AI Draft:
"${aiReply}"

Reply YES to post this.`;

  try {
    await bot.sendMessage(chatId, message);
    console.log(`[TELEGRAM] ✅ Review ${reviewId} sent to Telegram for approval`);
    return { success: true, message: 'Review sent to Telegram' };
  } catch (error) {
    console.error('[TELEGRAM] Failed to send approval request:', error.message);
    throw error;
  }
};

export const sendReviewForApproval = async (mockReviewData, aiReply) => {
  if (!bot || !chatId) {
    throw new Error('Telegram bot not initialized. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Secrets.');
  }

  const { customerName, starRating, reviewText } = mockReviewData;

  const stars = '⭐'.repeat(starRating);

  const message = `🌟 New Google Review!
From: ${customerName} (${starRating} ${stars})
Review: ${reviewText}

🤖 AI Proposed Reply:
${aiReply}

Reply 'YES' to post this to Google.`;

  try {
    await bot.sendMessage(chatId, message);
    console.log('✅ Review sent to Telegram for approval');
    return { success: true, message: 'Review sent to Telegram' };
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
    throw error;
  }
};

export const testTelegramApproval = (pool) => async (req, res) => {
  try {
    const mockReviewData = {
      customerName: 'John Smith',
      starRating: 5,
      reviewText: 'They fixed my iPhone screen in just 30 minutes! Great service and fair prices. Highly recommend!'
    };

    const aiReply = 'Thank you so much for your kind words, John! We\'re thrilled to hear that we could fix your iPhone screen in just 30 minutes. If you ever need help with any other devices, like iPads or laptops, remember that Techy Miramar is here for you!';

    const result = await sendReviewForApproval(mockReviewData, aiReply);

    res.json({
      success: true,
      message: 'Test review sent to Telegram',
      data: {
        mockReviewData,
        aiReply
      }
    });
  } catch (error) {
    console.error('Error in test Telegram approval:', error);

    if (error.message.includes('not initialized')) {
      return res.status(500).json({
        success: false,
        error: 'Telegram bot not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Secrets.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send test review to Telegram',
      details: error.message
    });
  }
};
