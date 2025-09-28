import { redis } from './redis';

/**
 * Check if a repository has been registered with P5 (initialized with npx p5 init)
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @returns Promise<boolean> - true if repo is registered, false otherwise
 */
export async function isRepoRegistered(owner: string, repo: string): Promise<boolean> {
  try {
    const key = `${owner}-${repo}`;
    const existingData = await redis.get(key);
    return existingData !== null;
  } catch (error) {
    console.error('Error checking repo registration:', error);
    return false;
  }
}

/**
 * Get repository data if it exists
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @returns Promise<any> - repository data or null if not found
 */
export async function getRepoData(owner: string, repo: string): Promise<any | null> {
  try {
    const key = `${owner}-${repo}`;
    const existingData = await redis.get(key);
    return existingData ? JSON.parse(existingData) : null;
  } catch (error) {
    console.error('Error getting repo data:', error);
    return null;
  }
}
