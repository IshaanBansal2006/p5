import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export const getRedisClient = async () => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      username: 'default',
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    redisClient.on('error', (err) => {
      console.warn('Redis Client Error', err);
    });

    // Only connect if not in build mode
    if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV !== 'production') {
      await redisClient.connect();
    }

    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed:', error);
    return null;
  }
};

export const redis = {
  async get(key: string) {
    const client = await getRedisClient();
    if (!client) return null;
    try {
      return await client.get(key);
    } catch (error) {
      console.warn('Redis get error:', error);
      return null;
    }
  },
  async set(key: string, value: string, options?: { EX?: number }) {
    const client = await getRedisClient();
    if (!client) return;
    try {
      await client.set(key, value, options);
    } catch (error) {
      console.warn('Redis set error:', error);
    }
  },
  async del(key: string) {
    const client = await getRedisClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch (error) {
      console.warn('Redis del error:', error);
    }
  }
};
