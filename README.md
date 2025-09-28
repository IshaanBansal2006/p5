# Player5 - Hackathon Platform

A comprehensive hackathon development platform that combines a powerful CLI tool with a web dashboard for project management, analytics, and collaboration.

## 🚀 **What is Player5?**

Player5 is a full-stack hackathon platform that provides:

- **CLI Tool**: Automated project setup, testing, and content generation
- **Web Dashboard**: Real-time project analytics, bug tracking, and task management
- **Server API**: Centralized repository analysis and content generation
- **Subdomain System**: Each project gets its own dashboard at `{owner}.{repo}.player5.vercel.app`

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Player5 CLI   │───▶│  Server API     │───▶│   MongoDB       │
│   (Local)       │    │  (Vercel)       │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Web Dashboard  │
                       │  (Next.js)      │
                       └─────────────────┘
```

## 📦 **Components**

### **1. CLI Tool (`/cli`)**
- **Commands**: `init`, `test`, `devpost gen`, `readme sync`, `stats`, `report`, `add task`
- **Features**: Project setup, testing, content generation, server integration
- **Tech**: TypeScript, Node.js, Yargs

### **2. Server API (`/server`)**
- **Endpoints**: `/api/repos`, `/api/stats`, `/api/tasks`, `/api/bugs`
- **Features**: GitHub API integration, content generation, data storage
- **Tech**: Node.js, Express, MongoDB, GitHub API

### **3. Web Dashboard (`/dashboard`)**
- **Pages**: Stats, Bugs, Tasks
- **Features**: Real-time updates, project management, analytics
- **Tech**: Next.js, React, Tailwind CSS

## 🛠️ **Setup & Installation**

### **Prerequisites**
- Node.js 18+
- MongoDB (local or cloud)
- GitHub API token

### **1. Server Setup**

```bash
cd server
npm install
cp env.example .env
# Edit .env with your MongoDB URI and GitHub token
npm run dev
```

### **2. CLI Setup**

```bash
cd cli
npm install
npm run build
npm link
```

### **3. Dashboard Setup**

```bash
cd dashboard
npm install
npm run dev
```

## 🚀 **Usage**

### **Initialize a Project**

```bash
p5 init
# Follow prompts to configure your project
# This will register your repo with the server
```

### **Generate Content**

```bash
# Generate Devpost submission
p5 devpost gen

# Generate README
p5 readme sync

# Get repository stats
p5 stats
```

### **Project Management**

```bash
# Report a bug
p5 report --title "Login button not working" --severity high

# Add a task
p5 add task --title "Add dark mode" --priority medium

# Run tests
p5 test --stage pre-commit
```

### **Web Dashboard**

Visit your project dashboard at:
- **Main Dashboard**: `https://player5.vercel.app`
- **Project Dashboard**: `https://{owner}.{repo}.player5.vercel.app`

## 📊 **Features**

### **CLI Features**
- ✅ Project initialization with Git setup
- ✅ Automated testing (lint, typecheck, build, e2e)
- ✅ Content generation (Devpost, README)
- ✅ Repository analytics
- ✅ Bug reporting and task management
- ✅ Server integration

### **Server Features**
- ✅ GitHub API integration
- ✅ Repository analysis and stats
- ✅ Content generation using AI
- ✅ MongoDB data storage
- ✅ RESTful API endpoints
- ✅ Rate limiting and security

### **Dashboard Features**
- ✅ Real-time repository statistics
- ✅ Bug tracking with assignable checkboxes
- ✅ Task management system
- ✅ Responsive design
- ✅ Project-specific subdomains

## 🔧 **Configuration**

### **Environment Variables**

**Server (`.env`)**:
```env
MONGODB_URI=mongodb://localhost:27017/player5
GITHUB_TOKEN=your_github_token
API_KEY=your_secure_api_key
```

**CLI**:
```bash
export P5_SERVER_URL=https://player5-server.vercel.app
export P5_API_KEY=your_secure_api_key
```

### **Project Config (`p5.config.ts`)**:
```typescript
export default {
  project: {
    name: "My Project",
    repo: "owner/repo",
    demoUrl: "https://myproject.com"
  },
  server: {
    url: "https://player5-server.vercel.app",
    apiKey: "your_api_key"
  }
  // ... other config
} satisfies P5Config;
```

## 🌐 **Deployment**

### **Server (Vercel)**
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy from `/server` directory

### **Dashboard (Vercel)**
1. Deploy from `/dashboard` directory
2. Configure subdomain routing in Cloudflare
3. Set up wildcard DNS for `*.player5.vercel.app`

### **CLI (npm)**
```bash
cd cli
npm publish
```

## 📈 **API Endpoints**

### **Repositories**
- `POST /api/repos/register` - Register a new repository
- `POST /api/repos/devpost` - Generate Devpost content
- `POST /api/repos/readme` - Generate README content
- `GET /api/repos/:owner/:repo` - Get repository info

### **Statistics**
- `GET /api/stats/:owner/:repo` - Get repository stats
- `GET /api/stats` - Get all repository stats

### **Tasks**
- `POST /api/tasks` - Add a new task
- `GET /api/tasks/:owner/:repo` - Get tasks for repository
- `PUT /api/tasks/:taskId` - Update task
- `DELETE /api/tasks/:taskId` - Delete task

### **Bugs**
- `POST /api/bugs` - Report a bug
- `GET /api/bugs/:owner/:repo` - Get bugs for repository
- `PUT /api/bugs/:bugId` - Update bug
- `DELETE /api/bugs/:bugId` - Delete bug

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- **Issues**: [GitHub Issues](https://github.com/your-org/player5/issues)
- **Documentation**: [Wiki](https://github.com/your-org/player5/wiki)
- **Discord**: [Join our community](https://discord.gg/player5)

---

**Built with ❤️ for the hackathon community**

