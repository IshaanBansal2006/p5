'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GitCommitVertical as GitCommit, Users, Clock, TrendingUp, GitBranch, Star, Trophy, Award, GitMerge, Loader2, Minus, Github } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RepoLayout from "@/components/RepoLayout";

interface StatsData {
  branches: { current: number; percentChange: number };
  totalCommits: { current: number; percentChange: number };
  totalContributors: { current: number; percentChange: number };
  totalLinesOfCode: { current: number; percentChange: number };
  commitsAnalyzed: number;
}

interface TimeSeriesData {
  date: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  contributors: string[];
}

interface CommitData {
  sha: string;
  author: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  changes: number;
}

interface ContributorStats {
  name: string;
  commits: number;
  additions: number;
  deletions: number;
  branches: number;
  merges: number;
  avatar_url?: string;
}

interface Awards {
  biggestCommitter: { name: string; commits: number };
  biggestMerger: { name: string; merges: number };
  biggestBrancher: { name: string; branches: number };
  leastContributor: { name: string; commits: number };
}

interface StatsResponse {
  repository: string;
  recentCommitHistory: CommitData[];
  timeSeriesData: TimeSeriesData[];
  awards: Awards;
  stats: StatsData;
  contributorStats: ContributorStats[];
  generatedAt: string;
}

const RepoStats = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [showAllCommits, setShowAllCommits] = useState(false);
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stats?owner=${owner}&repo=${repo}`);
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStatsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (owner && repo) {
      fetchStats();
    }
  }, [owner, repo]);

  const formatChange = (percentChange: number) => {
    const sign = percentChange >= 0 ? '+' : '';
    return `${sign}${percentChange.toFixed(1)}% last 12h`;
  };

  const getChangeIcon = (percentChange: number) => {
    if (percentChange === 0) return Minus;
    return TrendingUp;
  };

  const getChangeColor = (percentChange: number) => {
    if (percentChange === 0) return 'text-gray-500';
    return 'text-green-500';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  };

  const getCommitStatus = (commit: CommitData) => {
    // Simple heuristic: if there are more additions than deletions, consider it successful
    return commit.additions >= commit.deletions ? 'success' : 'failed';
  };

  if (loading) {
    return (
      <RepoLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading repository statistics...</span>
          </div>
        </div>
      </RepoLayout>
    );
  }

  if (error || !statsData) {
    return (
      <RepoLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Error Loading Stats</h2>
          <p className="text-muted-foreground mb-4">{error || 'Failed to load repository statistics'}</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </RepoLayout>
    );
  }

  const stats = [
    { 
      icon: GitCommit, 
      label: "Total Commits", 
      value: statsData.stats.totalCommits.current.toString(), 
      change: formatChange(statsData.stats.totalCommits.percentChange),
      changeIcon: getChangeIcon(statsData.stats.totalCommits.percentChange),
      changeColor: getChangeColor(statsData.stats.totalCommits.percentChange)
    },
    { 
      icon: Users, 
      label: "Contributors", 
      value: statsData.stats.totalContributors.current.toString(), 
      change: formatChange(statsData.stats.totalContributors.percentChange),
      changeIcon: getChangeIcon(statsData.stats.totalContributors.percentChange),
      changeColor: getChangeColor(statsData.stats.totalContributors.percentChange)
    },
    { 
      icon: GitBranch, 
      label: "Branches", 
      value: statsData.stats.branches.current.toString(), 
      change: formatChange(statsData.stats.branches.percentChange),
      changeIcon: getChangeIcon(statsData.stats.branches.percentChange),
      changeColor: getChangeColor(statsData.stats.branches.percentChange)
    },
    { 
      icon: Star, 
      label: "Lines of Code", 
      value: statsData.stats.totalLinesOfCode.current.toString(), 
      change: formatChange(statsData.stats.totalLinesOfCode.percentChange),
      changeIcon: getChangeIcon(statsData.stats.totalLinesOfCode.percentChange),
      changeColor: getChangeColor(statsData.stats.totalLinesOfCode.percentChange)
    },
  ];

  // Process time series data for the line chart (total lines of code over commits)
  const timeSeriesData = statsData.timeSeriesData.map((data, index) => {
    const cumulativeLines = statsData.timeSeriesData
      .slice(0, index + 1)
      .reduce((sum, d) => sum + d.linesAdded - d.linesDeleted, 0);
    
    return {
      date: data.date,
      commits: index + 1, // Commit number in chronological order
      loc: cumulativeLines, // Cumulative lines of code
      contributor: data.contributors[0] || 'Unknown'
    };
  });

  // Process recent commits
  const recentCommits = statsData.recentCommitHistory.slice(0, 8).map(commit => ({
    author: commit.author,
    message: commit.message,
    time: formatTimeAgo(commit.date),
    status: getCommitStatus(commit),
    hash: commit.sha.substring(0, 7),
    fullHash: commit.sha,
    date: commit.date,
    additions: commit.additions,
    deletions: commit.deletions
  }));

  // Process contributors - use the contributor stats from the API which includes avatar URLs
  const contributors = statsData.contributorStats
    .map(contributor => ({
      name: contributor.name,
      commits: contributor.commits,
      avatar: contributor.name.charAt(0).toUpperCase(), // Fallback to first letter
      avatar_url: contributor.avatar_url,
      linesAdded: contributor.additions,
      linesRemoved: contributor.deletions
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5);

  const awards = [
    {
      title: "Biggest Committer",
      winner: statsData.awards.biggestCommitter.name,
      value: `${statsData.awards.biggestCommitter.commits} commits`,
      icon: Trophy,
      color: "text-yellow-500"
    },
    {
      title: "Biggest Merger",
      winner: statsData.awards.biggestMerger.name,
      value: `${statsData.awards.biggestMerger.merges} merges`,
      icon: GitMerge,
      color: "text-blue-500"
    },
    {
      title: "Tree Lover",
      winner: statsData.awards.biggestBrancher.name,
      value: `${statsData.awards.biggestBrancher.branches} branches`,
      icon: GitBranch,
      color: "text-green-500"
    },
    {
      title: "Least Contributor",
      winner: statsData.awards.leastContributor.name,
      value: `${statsData.awards.leastContributor.commits} commits`,
      icon: Award,
      color: "text-purple-500"
    }
  ];

  const maxContributorCommits = Math.max(...contributors.map(c => c.commits), 1);

  return (
    <RepoLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">Repository Statistics & Analytics</p>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(statsData.generatedAt).toLocaleString()}
            </p>
          </div>
          <a 
            href={`https://github.com/${owner}/${repo}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="w-4 h-4 mr-2" />
              View on GitHub
            </Button>
          </a>
        </div>
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
                  <stat.changeIcon className={`w-4 h-4 ${stat.changeColor}`} />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className={`text-xs ${stat.changeColor}`}>{stat.change}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Time Series Chart - Line Graph */}
          {timeSeriesData.length > 0 && (
            <Card className="p-6 bg-gradient-card border-border/40">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Total Lines of Code Over Commits
              </h3>
              <div className="h-64 bg-background/10 rounded-lg p-4">
                <div className="h-full relative">
                  <svg className="w-full h-full" viewBox="0 0 400 200">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    
                    {/* Line graph */}
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                      points={timeSeriesData.map((data, index) => {
                        const x = (index / (timeSeriesData.length - 1)) * 380 + 10;
                        const y = 190 - ((data.loc / Math.max(...timeSeriesData.map(d => d.loc), 1)) * 170);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* Data points with hover tooltips */}
                    {timeSeriesData.map((data, index) => {
                      const x = (index / (timeSeriesData.length - 1)) * 380 + 10;
                      const y = 190 - ((data.loc / Math.max(...timeSeriesData.map(d => d.loc), 1)) * 170);
                      return (
                        <g key={index}>
                          <circle
                            cx={x}
                            cy={y}
                            r="3"
                            fill="currentColor"
                            className="text-primary cursor-pointer hover:r-4 transition-all"
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r="8"
                            fill="transparent"
                            className="cursor-pointer"
                          >
                            <title>
                              Commit #{data.commits}
                              {`\n`}Lines of Code: {data.loc.toLocaleString()}
                              {`\n`}Date: {new Date(data.date).toLocaleDateString()}
                              {`\n`}Contributor: {data.contributor}
                            </title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary/20 rounded"></div>
                  <span className="text-muted-foreground">Cumulative Lines of Code</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {statsData.stats.commitsAnalyzed} commits analyzed
                </div>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <Card className="p-6 bg-gradient-card border-border/40">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Commits
                </h3>
                <Dialog open={showAllCommits} onOpenChange={setShowAllCommits}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">View All</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>All Commits</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {recentCommits.map((commit, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-background/20 border border-border/20">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${commit.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div>
                              <p className="font-medium text-sm">{commit.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {commit.author} • {commit.time} • {commit.hash}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(commit.date).toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                <span className="text-green-600">+{commit.additions}</span> <span className="text-red-600">-{commit.deletions}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-4">
                {recentCommits.slice(0, 4).map((commit, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-background/20 border border-border/20">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${commit.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-medium text-sm">{commit.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {commit.author} • {commit.time} • {commit.hash}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(commit.date).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="text-green-600">+{commit.additions}</span> <span className="text-red-600">-{commit.deletions}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Contributors */}
            <Card className="p-6 bg-gradient-card border-border/40">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Top Contributors
                </h3>
                <Dialog open={showAllContributors} onOpenChange={setShowAllContributors}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">View All</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>All Contributors</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {contributors.map((contributor, index) => (
                        <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-background/20 border border-border/20">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center font-semibold overflow-hidden">
                              {contributor.avatar_url ? (
                                <Image 
                                  src={contributor.avatar_url} 
                                  alt={contributor.name}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                contributor.avatar
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{contributor.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {contributor.commits} commits • +{contributor.linesAdded} -{contributor.linesRemoved}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="w-20 h-2 bg-background/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(contributor.commits / maxContributorCommits) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-4">
                {contributors.slice(0, 5).map((contributor, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-semibold overflow-hidden">
                        {contributor.avatar_url ? (
                          <Image 
                            src={contributor.avatar_url} 
                            alt={contributor.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          contributor.avatar
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{contributor.name}</p>
                        <p className="text-xs text-muted-foreground">{contributor.commits} commits</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-16 h-2 bg-background/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(contributor.commits / maxContributorCommits) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Awards Section */}
          <Card className="p-6 bg-gradient-card border-border/40">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Team Awards
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {awards.map((award, index) => (
                <div key={index} className="bg-background/20 rounded-lg p-4 border border-border/20 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <award.icon className={`w-6 h-6 ${award.color}`} />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{award.title}</h4>
                  <p className="text-primary font-medium">{award.winner}</p>
                  <p className="text-xs text-muted-foreground">{award.value}</p>
                </div>
              ))}
            </div>
          </Card>

        </div>
    </RepoLayout>
  );
};

export default RepoStats;