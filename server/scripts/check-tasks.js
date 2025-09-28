// Script to check tasks in Redis
require('dotenv').config();
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

// Connect to Redis
redis.on('error', (err) => console.log('Redis Client Error', err));

async function checkTasks() {
  try {
    await redis.connect();
    console.log('Connected to Redis');

    // Check your repository
    const key = 'IshaanBansal2006-p5';
    const data = await redis.get(key);
    
    if (data) {
      const repositoryData = JSON.parse(data);
      console.log(`\nRepository: IshaanBansal2006/p5`);
      console.log(`Total tasks: ${repositoryData.tasks.length}`);
      console.log(`Total bugs: ${repositoryData.bugs.length}`);
      
      console.log('\nTasks:');
      repositoryData.tasks.forEach((task, index) => {
        console.log(`${index + 1}. ${task.title} (${task.status}) - ${task.assignee}`);
      });
    } else {
      console.log('No data found for IshaanBansal2006/p5');
    }

    await redis.disconnect();
    console.log('\nDisconnected from Redis');

  } catch (error) {
    console.error('Error checking tasks:', error);
    process.exit(1);
  }
}

// Run the script
checkTasks();
