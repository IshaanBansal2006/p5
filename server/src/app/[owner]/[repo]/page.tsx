import { createClient } from 'redis';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    owner: string;
    repo: string;
  };
}

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
await redis.connect();

export default async function RepositoryPage({ params }: PageProps) {
  const { owner, repo } = params;
  
  try {
    // Create the Redis key in the same format as the register endpoint
    const key = `${owner}-${repo}`;
    
    // Check if the key exists
    const exists = await redis.exists(key);
    
    if (!exists) {
      // Redirect to 404 if key doesn't exist
      notFound();
    }
    
    // Get the data from Redis
    const data = await redis.get(key);
    
    if (!data) {
      // If data is null, redirect to 404
      notFound();
    }
    
    // Parse the JSON data
    const repositoryData = JSON.parse(data);
    
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Repository: {owner}/{repo}
          </h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Repository Data</h2>
            <pre className="bg-gray-50 p-4 rounded border overflow-auto text-sm">
              {JSON.stringify(repositoryData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
    
  } catch (error) {
    console.error('Error fetching repository data:', error);
    notFound();
  }
}
