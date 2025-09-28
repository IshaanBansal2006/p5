'use client';

import { Button } from "@/components/ui/button";
import { Terminal, Zap, Settings, FileText, BarChart3, Github, Copy, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";


const Home = () => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText('npm i player5');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  const features = [
    {
      icon: Terminal,
      title: "Multi-Stage Testing",
      description: "Run comprehensive tests with p5 test for pre-commit, pre-push, and CI stages. Includes linting, build checks, and website testing with Puppeteer.",
    },
    {
      icon: Settings,
      title: "Project Initialization",
      description: "One-command setup with p5 init. Configures git hooks, GitHub workflows, npm scripts, and registers your project with the dashboard.",
    },
    {
      icon: FileText,
      title: "AI-Generated README",
      description: "Auto-generate professional READMEs with p5 readme sync. Analyzes your codebase and creates comprehensive documentation with tech stack and features.",
    },
    {
      icon: Zap,
      title: "Devpost Generation",
      description: "Generate hackathon-ready Devpost submissions with p5 devpost gen. AI analyzes your project and creates compelling project descriptions.",
    },
    {
      icon: BarChart3,
      title: "Repository Dashboard",
      description: "View comprehensive project analytics with p5 dashboard. Track commits, contributors, bugs, and tasks in a beautiful web interface.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src='/p5-logo.png' alt="Player5" width={40} height={40} className="w-10 h-10" />
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Player5
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <Github className="w-4 h-4" />
                GitHub
              </Button>
              <Link href="/documentation">
                <Button variant="outline" size="sm">
                  Documentation
                </Button>
              </Link>
              <Link href="/documentation#get-started">
                <Button variant="default" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-hero"></div>
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/hero-image.jpg"
            alt="Developer workspace"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 text-white">
              Have no fear,<br /><span className="bg-gradient-primary bg-clip-text text-transparent">Player 5</span> is here.
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Add a fifth player to your dev team to automate the tedious aspects of the hackathon development process.
            </p>
            <div className="flex flex-col items-center gap-6">
              {/* Code Block */}
              <div className="relative flex items-center justify-center gap-3 bg-gradient-card rounded-lg px-4 py-3 w-full max-w-md">
                <code className="text-white font-mono text-lg" style={{ fontFamily: 'Fira Code, monospace' }}>
                  npm i <span className="font-black bg-gradient-primary bg-clip-text text-transparent">player5</span>
                </code>
                <button
                  onClick={copyToClipboard}
                  className="absolute right-2 p-2 text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Get Started Button */}
              <Link href="/documentation#get-started">
                <Button variant="hero" size="lg" className="text-lg px-8 py-4 transition-all duration-300">
                  <Terminal className="w-5 h-5" />
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-card">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need for <span className="text-primary">Rapid Development</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built specifically for hackathons and fast-paced development cycles
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-card/50 backdrop-blur-sm p-8 rounded-xl border border-border/40 hover:border-primary/20 transition-smooth hover:shadow-elevated group"
              >
                <div className="mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-smooth">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-8">Get Started in Seconds</h2>
            <div className="bg-secondary/20 backdrop-blur-sm rounded-xl p-8 border border-border/40">
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <code className="text-primary font-mono">npm install -g p5</code>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <code className="text-primary font-mono">cd your-project && p5 init</code>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <code className="text-primary font-mono">p5 test</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/p5-logo.png" alt="Player5" width={32} height={32} className="w-8 h-8" />
            <span className="text-xl font-bold">Player5</span>
          </div>
          <p className="text-muted-foreground">
            Making hackathon development faster and less painful, one commit at a time.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
