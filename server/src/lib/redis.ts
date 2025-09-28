import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let isConnecting = false;

export const getRedisClient = async () => {
  // If client exists and is connected, return it
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // If we're already connecting, wait for it to complete
  if (isConnecting) {
    // Wait a bit and try again, but limit retries
    let retries = 0;
    while (isConnecting && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }
  }

  // If client exists but is not connected, try to reconnect
  if (redisClient && !redisClient.isOpen) {
    try {
      await redisClient.connect();
      return redisClient;
    } catch (error) {
      console.warn('Redis reconnection failed:', error);
      redisClient = null;
    }
  }

  // Create new client
  isConnecting = true;
  
  try {
    // Add a small delay to prevent rapid connection attempts
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Creating Redis client with config:', {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      hasPassword: !!process.env.REDIS_PASSWORD
    });

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

    redisClient.on('connect', () => {
      console.log('Redis client connected successfully');
    });

    redisClient.on('end', () => {
      console.log('Redis client disconnected');
    });

    // Connect to Redis
    await redisClient.connect();

    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed:', error);
    redisClient = null;
    return null;
  } finally {
    isConnecting = false;
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
    if (!client) return 0;
    try {
      return await client.del(key);
    } catch (error) {
      console.warn('Redis del error:', error);
      return 0;
    }
  },
  async keys(pattern: string) {
    const client = await getRedisClient();
    if (!client) return [];
    try {
      return await client.keys(pattern);
    } catch (error) {
      console.warn('Redis keys error:', error);
      return [];
    }
  }
};

// Cleanup function to close Redis connection
export const closeRedisConnection = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.warn('Error closing Redis connection:', error);
    }
  }
  redisClient = null;
};
