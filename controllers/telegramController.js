import TelegramBot from 'node-telegram-bot-api';

let bot;
let chatId;

export const initializeTelegramBot = () => {
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
        await bot.sendMessage(incomingChatId, '✅ Reply Posted! (Mock Mode)');
        console.log('📤 Posting to Google API...');
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
