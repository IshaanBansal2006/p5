'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GitCommitVertical as GitCommit, Users, Clock, GitBranch, Star, Trophy, Award, GitMerge, Loader2, Github } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RepoLayout from "@/components/RepoLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsData {
  branches: { current: number };
  totalCommits: { current: number };
  totalContributors: { current: number };
  totalLinesOfCode: { current: number };
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
          if (response.status === 404) {
            setError('Repository not found or not initialized with P5');
            return;
          }
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
      value: statsData.stats?.totalCommits?.current?.toString() || "0"
    },
    { 
      icon: Users, 
      label: "Contributors", 
      value: statsData.stats?.totalContributors?.current?.toString() || "0"
    },
    { 
      icon: GitBranch, 
      label: "Branches", 
      value: statsData.stats?.branches?.current?.toString() || "0"
    },
    { 
      icon: Star, 
      label: "Lines of Code", 
      value: statsData.stats?.totalLinesOfCode?.current?.toString() || "0"
    },
  ];

  // Process time series data for the line chart (total lines of code over commits)
  const timeSeriesData = (statsData.timeSeriesData || []).map((data, index) => {
    const cumulativeLines = (statsData.timeSeriesData || [])
      .slice(0, index + 1)
      .reduce((sum, d) => sum + d.linesAdded - d.linesDeleted, 0);
    
    return {
      date: data.date,
      commits: index + 1, // Commit number in chronological order
      loc: cumulativeLines, // Cumulative lines of code
      contributor: data.contributors[0] || 'Unknown'
    };
  });

  // Process recent commits (GitHub API returns most recent first)
  const recentCommits = (statsData.recentCommitHistory || []).map(commit => ({
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
  const contributors = (statsData.contributorStats || [])
    .map(contributor => ({
      name: contributor.name,
      commits: contributor.commits,
      avatar: contributor.name.charAt(0).toUpperCase(), // Fallback to first letter
      avatar_url: contributor.avatar_url,
      linesAdded: contributor.additions,
      linesRemoved: contributor.deletions
    }))
    .sort((a, b) => b.commits - a.commits);

  const awards = [
    {
      title: "Biggest Committer",
      winner: statsData.awards?.biggestCommitter?.name || "Unknown",
      value: `${statsData.awards?.biggestCommitter?.commits || 0} commits`,
      icon: Trophy,
      color: "text-yellow-500"
    },
    {
      title: "Biggest Merger",
      winner: statsData.awards?.biggestMerger?.name || "Unknown",
      value: `${statsData.awards?.biggestMerger?.merges || 0} merges`,
      icon: GitMerge,
      color: "text-blue-500"
    },
    {
      title: "Tree Lover",
      winner: statsData.awards?.biggestBrancher?.name || "Unknown",
      value: `${statsData.awards?.biggestBrancher?.branches || 0} branches`,
      icon: GitBranch,
      color: "text-green-500"
    },
    {
      title: "Least Contributor",
      winner: statsData.awards?.leastContributor?.name || "Unknown",
      value: `${statsData.awards?.leastContributor?.commits || 0} commits`,
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
              Last updated: {statsData.generatedAt ? new Date(statsData.generatedAt).toLocaleString() : 'Unknown'}
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
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Time Series Chart - Line Graph */}
          {timeSeriesData.length > 0 && (
            <Card className="p-6 bg-gradient-card border-border/40">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Total Lines of Code Over Commits
              </h3>
              <div className="h-64 bg-background/10 rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.3} />
                    <XAxis 
                      dataKey="commits" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `#${value}`}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">Commit #{data.commits}</p>
                              <p className="text-sm text-muted-foreground">
                                Lines of Code: {data.loc.toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Date: {new Date(data.date).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Contributor: {data.contributor}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="loc" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary/20 rounded"></div>
                  <span className="text-muted-foreground">Cumulative Lines of Code</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {statsData.stats?.commitsAnalyzed || 0} commits analyzed
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
                {recentCommits.slice(0, 5).map((commit, index) => (
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
                {contributors.map((contributor, index) => (
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
                        <p className="text-xs text-muted-foreground">
                          {contributor.commits} commits • +{contributor.linesAdded} -{contributor.linesRemoved}
                        </p>
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