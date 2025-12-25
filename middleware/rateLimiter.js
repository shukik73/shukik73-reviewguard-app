import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../utils/redis.js';

function createRedisStore(prefix) {
  const redisClient = getRedisClient();
  
  if (!redisClient || !isRedisConnected()) {
    return null;
  }

  try {
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (error) {
    console.error(`[RATE-LIMIT] Failed to create Redis store for ${prefix}:`, error.message);
    return null;
  }
}

export function createRateLimiters() {
  const smsStore = createRedisStore('sms');
  const apiStore = createRedisStore('api');
  const useRedis = smsStore !== null;

  if (useRedis) {
    console.log('[RATE-LIMIT] Using Redis store for rate limiting');
  } else {
    console.log('[RATE-LIMIT] Using in-memory store for rate limiting');
  }

  const smsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      error: 'Too many SMS requests. Maximum 10 messages per hour allowed.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: smsStore || undefined,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many SMS requests. Maximum 10 messages per hour allowed. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: apiStore || undefined,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many API requests. Maximum 100 requests per 15 minutes allowed.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
  });

  console.log(`✅ Rate limiters initialized with ${useRedis ? 'Redis' : 'in-memory'} storage`);

  return { smsLimiter, apiLimiter };
}
