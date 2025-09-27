'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GitCommitVertical as GitCommit, Users, Clock, TrendingUp, GitBranch, Star, Trophy, Award, GitMerge } from "lucide-react";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const RepoStats = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [showAllCommits, setShowAllCommits] = useState(false);

  const stats = [
    { icon: GitCommit, label: "Total Commits", value: "247", change: "+12 this week" },
    { icon: Users, label: "Contributors", value: "5", change: "+1 this month" },
    { icon: GitBranch, label: "Branches", value: "8", change: "3 active" },
    { icon: Star, label: "Build Success", value: "94%", change: "+2% this week" },
  ];

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
              <Link href="/">
                <Button variant="outline" size="sm">
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{owner}/{repo}</h1>
          <p className="text-muted-foreground">Repository Statistics & Analytics</p>
        </div>

        <div className="space-y-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 bg-gradient-card border-border/40 hover:border-primary/20 transition-smooth">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-xs text-green-500">{stat.change}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <Link href={`/${owner}/${repo}/bugs`}>
              <Button variant="outline">View Bugs</Button>
            </Link>
            <Link href={`/${owner}/${repo}/tasks`}>
              <Button variant="outline">View Tasks</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepoStats;