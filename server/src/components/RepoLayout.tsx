'use client';
import { Button } from "@/components/ui/button";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChartBar as BarChart3, Bug, SquareCheck as CheckSquare, Github, Star, GitFork } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface RepoLayoutProps {
  children: React.ReactNode;
}

interface RepoData {
  stargazers_count: number;
  forks_count: number;
  description: string | null;
}

const RepoLayout = ({ children }: RepoLayoutProps) => {
  const params = useParams();
  const pathname = usePathname();
  const { owner, repo } = params;
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/repo-info?owner=${owner}&repo=${repo}`);
        if (response.ok) {
          const data = await response.json();
          setRepoData(data);
        }
      } catch (error) {
        console.error('Failed to fetch repo data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (owner && repo) {
      fetchRepoData();
    }
  }, [owner, repo]);

  const tabs = [
    { id: "stats", label: "Stats", icon: BarChart3, path: `/${owner}/${repo}` },
    { id: "bugs", label: "Issues", icon: Bug, path: `/${owner}/${repo}/bugs` },
    { id: "tasks", label: "Tasks", icon: CheckSquare, path: `/${owner}/${repo}/tasks` },
  ];

  const currentTab = tabs.find(tab => pathname === tab.path) || tabs[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/p5-logo.png" alt="Player5" width={32} height={32} className="w-8 h-8" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Player5
              </span>
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

      {/* Repo Header */}
      <div className="bg-gradient-card border-b border-border/40">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {typeof repo === 'string' ? repo.charAt(0).toUpperCase() : 'R'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  <span className="text-muted-foreground">{owner}</span>
                  <span className="text-foreground"> / {repo}</span>
                </h1>
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading description...' : (repoData?.description || 'No description provided')}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">{repoData?.stargazers_count ?? '0'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitFork className="w-4 h-4" />
                    <span className="text-sm">{repoData?.forks_count ?? '0'}</span>
                  </div>
                  <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/20">
                    P5 Enabled
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-background/50 backdrop-blur-sm border-b border-border/40">
        <div className="container mx-auto px-6">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.path}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-smooth ${
                  currentTab.id === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
};

export default RepoLayout;
