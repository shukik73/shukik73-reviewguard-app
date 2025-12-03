import TelegramBot from 'node-telegram-bot-api';

let pool;
const userBots = new Map();

export const initializeTelegramBot = (dbPool) => {
  pool = dbPool;
  console.log('✅ Telegram multi-tenant controller initialized');
  
  startAllUserBots();
};

async function startAllUserBots() {
  if (!pool) {
    console.warn('⚠️  Database pool not available for Telegram initialization');
    return;
  }

  try {
    const result = await pool.query(
      `SELECT tc.user_id, tc.bot_token, tc.chat_id 
       FROM telegram_configs tc
       WHERE tc.is_active = true`
    );

    for (const config of result.rows) {
      try {
        await startBotForUser(config.user_id, config.bot_token, config.chat_id);
      } catch (error) {
        console.error(`[TELEGRAM] Failed to start bot for user ${config.user_id}:`, error.message);
      }
    }

    if (result.rows.length > 0) {
      console.log(`✅ Started ${result.rows.length} Telegram bot(s) for active users`);
    } else {
      console.log('ℹ️  No active Telegram configurations found');
    }
  } catch (error) {
    console.error('[TELEGRAM] Error loading bot configurations:', error.message);
  }
}

async function startBotForUser(userId, botToken, chatId) {
  if (userBots.has(userId)) {
    const existingBot = userBots.get(userId);
    try {
      await existingBot.bot.stopPolling();
    } catch (e) {
    }
    userBots.delete(userId);
  }

  const bot = new TelegramBot(botToken, { polling: true });
  
  userBots.set(userId, { bot, chatId, token: botToken });

  bot.on('message', async (msg) => {
    const incomingChatId = msg.chat.id.toString();
    const text = msg.text || '';
    const configuredChatId = chatId.toString();

    if (incomingChatId !== configuredChatId) {
      console.warn(`[TELEGRAM] ⚠️ Unauthorized access attempt for user ${userId}: incoming chat ${incomingChatId} !== configured chat ${configuredChatId}`);
      await bot.sendMessage(incomingChatId, '❌ Unauthorized. This bot is configured for a different chat.');
      return;
    }

    if (text.trim().toUpperCase() === 'YES') {
      console.log(`[TELEGRAM] YES command received from authorized chat for user ${userId}`);
      
      try {
        const result = await pool.query(
          `SELECT id, customer_name, star_rating, ai_proposed_reply 
           FROM pending_reviews 
           WHERE user_id = $1 AND status = 'pending' 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [userId]
        );

        if (result.rows.length === 0) {
          await bot.sendMessage(incomingChatId, '❌ No pending reviews found.');
          return;
        }

        const review = result.rows[0];

        await pool.query(
          `UPDATE pending_reviews 
           SET status = 'posted' 
           WHERE id = $1`,
          [review.id]
        );

        await bot.sendMessage(incomingChatId, `✅ Reply Posted to Google! (Simulated)\n\n📝 Review ID: ${review.id}\n👤 Customer: ${review.customer_name}\n⭐ Rating: ${review.star_rating} stars`);
        console.log(`[TELEGRAM] ✅ Review ${review.id} marked as posted for user ${userId}`);

      } catch (error) {
        console.error(`[TELEGRAM] Error processing YES command for user ${userId}:`, error);
        await bot.sendMessage(incomingChatId, '❌ Error posting review. Please try again.');
      }
    } else {
      await bot.sendMessage(incomingChatId, '❌ Edit mode not supported yet. Please log in to Dashboard.');
    }
  });

  bot.on('polling_error', (error) => {
    console.error(`[TELEGRAM] Polling error for user ${userId}:`, error.message);
  });

  console.log(`[TELEGRAM] ✅ Bot started for user ${userId}`);
  return bot;
}

export const getBotForUser = async (userId) => {
  if (userBots.has(userId)) {
    return userBots.get(userId);
  }

  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const result = await pool.query(
    `SELECT bot_token, chat_id, is_active 
     FROM telegram_configs 
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const config = result.rows[0];
  
  if (!config.is_active) {
    return null;
  }

  await startBotForUser(userId, config.bot_token, config.chat_id);
  
  return userBots.get(userId);
};

export const sendApprovalRequest = async (userId, reviewId, reviewData, aiReply) => {
  const userBot = await getBotForUser(userId);
  
  if (!userBot) {
    throw new Error('Telegram bot not configured. Please set up your Telegram Bot Token and Chat ID in Settings.');
  }

  const { bot, chatId } = userBot;
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
    console.log(`[TELEGRAM] ✅ Review ${reviewId} sent to Telegram for user ${userId}`);
    return { success: true, message: 'Review sent to Telegram' };
  } catch (error) {
    console.error(`[TELEGRAM] Failed to send approval request for user ${userId}:`, error.message);
    throw error;
  }
};

export const sendReviewForApproval = async (userId, mockReviewData, aiReply) => {
  const userBot = await getBotForUser(userId);
  
  if (!userBot) {
    throw new Error('Telegram bot not configured. Please set up your Telegram Bot Token and Chat ID in Settings.');
  }

  const { bot, chatId } = userBot;
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
    console.log(`[TELEGRAM] ✅ Review sent to Telegram for approval (user ${userId})`);
    return { success: true, message: 'Review sent to Telegram' };
  } catch (error) {
    console.error(`[TELEGRAM] Failed to send Telegram message for user ${userId}:`, error.message);
    throw error;
  }
};

export const saveTelegramConfig = (pool) => async (req, res) => {
  try {
    const userId = req.user.id;
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Bot Token and Chat ID are required'
      });
    }

    try {
      const testBot = new TelegramBot(botToken, { polling: false });
      await testBot.getMe();
      
      await testBot.sendMessage(chatId, '✅ Telegram integration configured successfully! You will receive review approval requests here.');
    } catch (testError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Bot Token or Chat ID. Please verify your credentials.',
        details: testError.message
      });
    }

    const result = await pool.query(
      `INSERT INTO telegram_configs (user_id, bot_token, chat_id, is_active, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET bot_token = $2, chat_id = $3, is_active = true, updated_at = NOW()
       RETURNING id`,
      [userId, botToken, chatId]
    );

    await startBotForUser(userId, botToken, chatId);

    res.json({
      success: true,
      message: 'Telegram configuration saved successfully',
      configId: result.rows[0].id
    });

  } catch (error) {
    console.error('[TELEGRAM] Error saving config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save Telegram configuration',
      details: error.message
    });
  }
};

export const getTelegramConfig = (pool) => async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, chat_id, is_active, created_at, updated_at
       FROM telegram_configs 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        configured: false,
        config: null
      });
    }

    const config = result.rows[0];

    res.json({
      success: true,
      configured: true,
      config: {
        id: config.id,
        chatId: config.chat_id,
        isActive: config.is_active,
        hasToken: true,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }
    });

  } catch (error) {
    console.error('[TELEGRAM] Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Telegram configuration'
    });
  }
};

export const deleteTelegramConfig = (pool) => async (req, res) => {
  try {
    const userId = req.user.id;

    if (userBots.has(userId)) {
      const { bot } = userBots.get(userId);
      try {
        await bot.stopPolling();
      } catch (e) {
      }
      userBots.delete(userId);
    }

    await pool.query(
      `DELETE FROM telegram_configs WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Telegram configuration removed'
    });

  } catch (error) {
    console.error('[TELEGRAM] Error deleting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Telegram configuration'
    });
  }
};

export const testTelegramConnection = (pool) => async (req, res) => {
  try {
    const userId = req.user.id;
    const userBot = await getBotForUser(userId);

    if (!userBot) {
      return res.status(404).json({
        success: false,
        error: 'Telegram not configured. Please add your Bot Token and Chat ID first.'
      });
    }

    const { bot, chatId } = userBot;

    await bot.sendMessage(chatId, '🔔 Test Message\n\nYour Telegram integration is working correctly!');

    res.json({
      success: true,
      message: 'Test message sent successfully'
    });

  } catch (error) {
    console.error('[TELEGRAM] Test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test message',
      details: error.message
    });
  }
};

export const testTelegramApproval = (pool) => async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const mockReviewData = {
      customerName: 'John Smith',
      starRating: 5,
      reviewText: 'They fixed my iPhone screen in just 30 minutes! Great service and fair prices. Highly recommend!'
    };

    const aiReply = 'Thank you so much for your kind words, John! We\'re thrilled to hear that we could fix your iPhone screen in just 30 minutes. If you ever need help with any other devices, like iPads or laptops, we\'re here for you!';

    const result = await sendReviewForApproval(userId, mockReviewData, aiReply);

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

    if (error.message.includes('not configured')) {
      return res.status(400).json({
        success: false,
        error: 'Telegram bot not configured. Please set up your Bot Token and Chat ID in Settings.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send test review to Telegram',
      details: error.message
    });
  }
};
