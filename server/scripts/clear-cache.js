const { createClient } = require('redis');

// Redis client configuration
const redis = createClient({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

async function clearCorruptedCache() {
  try {
    await redis.connect();
    console.log('Connected to Redis');

    // Get all keys that might be corrupted
    const keys = await redis.keys('*stats*');
    console.log(`Found ${keys.length} cache keys to check:`);
    
    for (const key of keys) {
      try {
        const value = await redis.get(key);
        if (value) {
          // Try to parse the JSON
          JSON.parse(value);
          console.log(`✓ ${key} - Valid JSON`);
        } else {
          console.log(`- ${key} - Empty value`);
        }
      } catch (error) {
        console.log(`✗ ${key} - Corrupted JSON, deleting...`);
        await redis.del(key);
      }
    }

    console.log('Cache cleanup completed');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    await redis.disconnect();
  }
}

clearCorruptedCache();
