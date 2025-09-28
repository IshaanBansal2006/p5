import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Zap, Shield, FileText, Eye, Github, Book, Download, Settings } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-3">
                <Image src="/p5-logo.png" alt="Player5" width={56} height={56} className="w-14 h-14" />
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <Github className="w-4 h-4" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              <code style={{ fontFamily: 'Fira Code, monospace' }}>
                <span className="font-black bg-gradient-primary bg-clip-text text-transparent">player5</span>
              </code> Documentation
            </h1>
            <p className="text-xl text-muted-foreground">
              Complete guide to streamlining your hackathon development workflow
            </p>
          </div>

          {/* Table of Contents */}
          <Card className="p-6 mb-8 bg-gradient-card border-border/40">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Book className="w-6 h-6 text-primary" />
              Table of Contents
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <a href="#get-started" className="block text-primary hover:underline">1. Getting Started</a>
                <a href="#installation" className="block text-primary hover:underline">2. Installation</a>
                <a href="#configuration" className="block text-primary hover:underline">3. Configuration</a>
                <a href="#commands" className="block text-primary hover:underline">4. Commands</a>
              </div>
              <div className="space-y-2">
                <a href="#features" className="block text-primary hover:underline">5. Features</a>
                <a href="#automation" className="block text-primary hover:underline">6. Automation</a>
                <a href="#troubleshooting" className="block text-primary hover:underline">7. Troubleshooting</a>
                <a href="#api" className="block text-primary hover:underline">8. API Reference</a>
              </div>
            </div>
          </Card>

          {/* Getting Started Section */}
          <section id="get-started" className="mb-12">
            <Card className="p-8 bg-gradient-card border-border/40">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" />
                Getting Started
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                <code className="font-bold" style={{ fontFamily: 'Fira Code, monospace' }}><span className="font-black bg-gradient-primary bg-clip-text text-transparent">player5</span></code> (P5) is designed to automate the tedious parts of hackathon development,
                letting you focus on building amazing projects instead of managing builds, documentation, and deployments.
              </p>

              <div className="bg-secondary/20 backdrop-blur-sm rounded-xl p-6 border border-border/40 mb-6">
                <h3 className="text-xl font-semibold mb-4">Quick Setup</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Badge className="bg-primary/20 text-primary">1</Badge>
                    <code className="text-primary font-mono bg-background/20 px-3 py-1 rounded">npm install -g p5</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-primary/20 text-primary">2</Badge>
                    <code className="text-primary font-mono bg-background/20 px-3 py-1 rounded">cd your-project && p5 init</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-primary/20 text-primary">3</Badge>
                    <code className="text-primary font-mono bg-background/20 px-3 py-1 rounded">p5 test</code>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">What P5 Does</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Automated build testing
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      README auto-updates
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Devpost generation
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Commit break detection
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Prerequisites</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      Node.js 16+ installed
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      Git repository initialized
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      Package.json in project root
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          {/* Installation Section */}
          <section id="installation" className="mb-12">
            <Card className="p-8 bg-gradient-card border-border/40">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Download className="w-8 h-8 text-primary" />
                Installation
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Global Installation (Recommended)</h3>
                  <div className="bg-background/20 rounded-lg p-4 border border-border/20">
                    <code className="text-primary font-mono">npm install -g p5</code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Installs P5 globally so you can use it in any project
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Local Installation</h3>
                  <div className="bg-background/20 rounded-lg p-4 border border-border/20">
                    <code className="text-primary font-mono">npm install --save-dev p5</code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Installs P5 as a development dependency in your project
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Verify Installation</h3>
                  <div className="bg-background/20 rounded-lg p-4 border border-border/20">
                    <code className="text-primary font-mono">p5 --version</code>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Configuration Section */}
          <section id="configuration" className="mb-12">
            <Card className="p-8 bg-gradient-card border-border/40">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Settings className="w-8 h-8 text-primary" />
                Configuration
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Initialize P5 in Your Project</h3>
                  <div className="bg-background/20 rounded-lg p-4 border border-border/20 mb-3">
                    <code className="text-primary font-mono">p5 init</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    This creates a <code className="text-primary bg-background/20 px-2 py-1 rounded">.p5config.json</code> file with default settings.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Configuration Options</h3>
                  <div className="bg-background/20 rounded-lg p-4 border border-border/20">
                    <pre className="text-sm text-primary font-mono">
                      {`{
  "buildCommand": "npm run build",
  "testCommand": "npm test",
  "autoUpdate": true,
  "notifications": {
    "buildBreaks": true,
    "deployments": true
  },
  "integrations": {
    "github": true,
    "devpost": true
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Commands Section */}
          <section id="commands" className="mb-12">
            <Card className="p-8 bg-gradient-card border-border/40">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Terminal className="w-8 h-8 text-primary" />
                Commands
              </h2>

              <div className="grid gap-6">
                {[
                  {
                    command: "p5 test",
                    description: "Run build tests and basic validation",
                    example: "p5 test --verbose"
                  },
                  {
                    command: "p5 devpost gen",
                    description: "Generate Devpost submission draft",
                    example: "p5 devpost gen --template hackathon"
                  },
                  {
                    command: "p5 readme update",
                    description: "Update README with latest project info",
                    example: "p5 readme update --stats"
                  },
                  {
                    command: "p5 watch",
                    description: "Monitor for breaking commits",
                    example: "p5 watch --notify"
                  }
                ].map((cmd, index) => (
                  <div key={index} className="bg-background/20 rounded-lg p-4 border border-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-primary font-mono text-lg">{cmd.command}</code>
                    </div>
                    <p className="text-muted-foreground mb-2">{cmd.description}</p>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Example: </span>
                      <code className="text-accent font-mono">{cmd.example}</code>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Features Section */}
          <section id="features" className="mb-12">
            <Card className="p-8 bg-gradient-card border-border/40">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" />
                Features
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    icon: Terminal,
                    title: "Local Build Testing",
                    description: "Quickly validate your project builds and passes basic tests before pushing to remote."
                  },
                  {
                    icon: Shield,
                    title: "Commit Break Detection",
                    description: "Automatically detect breaking commits and notify responsible developers."
                  },
                  {
                    icon: FileText,
                    title: "Auto-Updating README",
                    description: "Keep your README fresh with build status, contributors, and recent changes."
                  },
                  {
                    icon: Eye,
                    title: "Playwright Test Generation",
                    description: "Create end-to-end tests by simply clicking through your application."
                  }
                ].map((feature, index) => (
                  <div key={index} className="bg-background/20 rounded-lg p-6 border border-border/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                    </div>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* More sections would continue here... */}
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              More sections coming soon. Check our GitHub for the latest updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
