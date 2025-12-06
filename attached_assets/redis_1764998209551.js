import Redis from 'ioredis';

let redisClient = null;
let isRedisAvailable = false;

export async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not configured. Rate limiting will use in-memory storage.');
    return null;
  }

  return new Promise((resolve) => {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 5000,
        commandTimeout: 5000,
      });

      const timeout = setTimeout(() => {
        console.warn('[REDIS] Connection timeout. Falling back to in-memory storage.');
        isRedisAvailable = false;
        resolve(null);
      }, 5000);

      redisClient.on('ready', () => {
        clearTimeout(timeout);
        console.log('✅ Redis connected and ready');
        isRedisAvailable = true;
        resolve(redisClient);
      });

      redisClient.on('error', (err) => {
        console.error('[REDIS] Connection error:', err.message);
        isRedisAvailable = false;
      });

      redisClient.on('close', () => {
        console.warn('[REDIS] Connection closed');
        isRedisAvailable = false;
      });

      redisClient.on('reconnecting', () => {
        console.log('[REDIS] Reconnecting...');
      });

    } catch (error) {
      console.error('[REDIS] Initialization error:', error.message);
      resolve(null);
    }
  });
}

export function getRedisClient() {
  return redisClient;
}

export function isRedisConnected() {
  return isRedisAvailable && redisClient && redisClient.status === 'ready';
}

export async function testRedisConnection() {
  if (!redisClient) {
    return { connected: false, error: 'Redis client not initialized' };
  }

  try {
    await redisClient.ping();
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
