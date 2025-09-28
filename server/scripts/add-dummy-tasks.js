// Script to add dummy tasks to Redis for demo purposes
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

async function addDummyTasks() {
  try {
    await redis.connect();
    console.log('Connected to Redis');

    // Demo repository data
    const demoRepos = [
      { owner: 'IshaanBansal2006', repo: 'p5' },
      { owner: 'microsoft', repo: 'vscode' },
      { owner: 'facebook', repo: 'react' },
      { owner: 'vercel', repo: 'next.js' }
    ];

    const dummyTasks = [
      {
        title: "Implement user authentication flow",
        description: "Set up JWT-based auth with login/register/logout functionality including password reset and email verification",
        priority: "high",
        status: "in-progress",
        assignee: "alex_dev",
        reporter: "product_manager",
        dueDate: "2024-02-15",
        tags: ["auth", "frontend", "backend", "security"]
      },
      {
        title: "Design responsive dashboard layout",
        description: "Create mobile-first responsive design for main dashboard with dark mode support",
        priority: "medium",
        status: "todo",
        assignee: "sarah_codes",
        reporter: "design_lead",
        dueDate: "2024-02-20",
        tags: ["ui", "responsive", "design", "css"]
      },
      {
        title: "Setup CI/CD pipeline",
        description: "Configure GitHub Actions for automated testing, linting, and deployment to staging and production",
        priority: "high",
        status: "completed",
        assignee: "mike_builds",
        reporter: "devops_lead",
        dueDate: "2024-02-10",
        tags: ["devops", "ci-cd", "automation", "github-actions"]
      },
      {
        title: "Optimize database queries",
        description: "Review and optimize slow queries identified in performance monitoring, add proper indexing",
        priority: "medium",
        status: "in-progress",
        assignee: "jenny_test",
        reporter: "tech_lead",
        dueDate: "2024-02-25",
        tags: ["database", "performance", "optimization", "sql"]
      },
      {
        title: "Write API documentation",
        description: "Document all REST endpoints with examples, response schemas, and error codes using OpenAPI spec",
        priority: "low",
        status: "todo",
        assignee: "tom_ui",
        reporter: "tech_writer",
        dueDate: "2024-03-01",
        tags: ["documentation", "api", "specs", "openapi"]
      },
      {
        title: "Fix memory leak in dashboard component",
        description: "Investigate and fix memory leak causing performance issues in the main dashboard component",
        priority: "critical",
        status: "in-progress",
        assignee: "sarah_codes",
        reporter: "qa_team",
        dueDate: "2024-02-12",
        tags: ["performance", "memory", "dashboard", "bug"]
      },
      {
        title: "Add unit tests for authentication module",
        description: "Write comprehensive unit tests for the authentication module with 90%+ coverage",
        priority: "medium",
        status: "todo",
        assignee: "alex_dev",
        reporter: "qa_lead",
        dueDate: "2024-02-28",
        tags: ["testing", "unit-tests", "auth", "coverage"]
      },
      {
        title: "Implement real-time notifications",
        description: "Add WebSocket support for real-time notifications and updates across the application",
        priority: "high",
        status: "todo",
        assignee: "mike_builds",
        reporter: "product_manager",
        dueDate: "2024-03-05",
        tags: ["websocket", "real-time", "notifications", "frontend"]
      }
    ];

    for (const { owner, repo } of demoRepos) {
      const key = `${owner}-${repo}`;
      
      // Check if repository data exists
      const existingData = await redis.get(key);
      let repositoryData;

      if (existingData) {
        repositoryData = JSON.parse(existingData);
      } else {
        repositoryData = {
          bugs: [],
          tasks: []
        };
      }

      // Add dummy tasks with proper structure
      const currentTime = new Date().toISOString();
      const newTasks = dummyTasks.map((task, index) => ({
        id: `T-${(index + 1).toString().padStart(4, '0')}`,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignee: task.assignee,
        reporter: task.reporter,
        dueDate: task.dueDate,
        createdAt: currentTime,
        updatedAt: currentTime,
        tags: task.tags,
        comments: [],
        completed: task.status === 'completed',
        checked: false
      }));

      // Add some variation to tasks for different repos
      if (owner === 'facebook') {
        newTasks[0].status = 'completed';
        newTasks[0].completed = true;
        newTasks[2].status = 'todo';
        newTasks[2].completed = false;
      } else if (owner === 'vercel') {
        newTasks[1].status = 'completed';
        newTasks[1].completed = true;
        newTasks[3].priority = 'critical';
      }

      repositoryData.tasks = newTasks;

      // Update Redis
      await redis.set(key, JSON.stringify(repositoryData));
      console.log(`Added ${newTasks.length} dummy tasks to ${owner}/${repo}`);
    }

    console.log('Successfully added dummy tasks to all demo repositories');
    await redis.disconnect();

  } catch (error) {
    console.error('Error adding dummy tasks:', error);
    process.exit(1);
  }
}

// Run the script
addDummyTasks();
