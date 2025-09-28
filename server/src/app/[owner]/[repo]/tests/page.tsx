'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Loader2, 
  RefreshCw,
  Calendar,
  Zap,
  Bug,
  Activity,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import RepoLayout from "@/components/RepoLayout";

// Interface for test execution data
interface TestExecution {
  id: string;
  executedAt: string;
  totalErrors: number;
  totalWarnings: number;
  totalDuration: number;
  stage: string;
}

interface DetailedTestExecution extends TestExecution {
  repository: {
    owner: string;
    repo: string;
  };
  sessionId: string;
  errors: Array<{
    taskName: string;
    errorType: 'lint' | 'typecheck' | 'build' | 'test' | 'website' | 'unknown';
    severity: 'error' | 'warning';
    message: string;
    location?: {
      file?: string;
      line?: number;
      column?: number;
    };
    timestamp: string;
    duration: number;
    rawOutput?: string;
  }>;
  summary: {
    byTask: Record<string, number>;
    byType: Record<string, number>;
  };
}

const Tests = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showFilter, setShowFilter] = useState(false);
  const [filterStage, setFilterStage] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showDetailed, setShowDetailed] = useState(false);
  const [testExecutions, setTestExecutions] = useState<TestExecution[]>([]);
  const [detailedExecutions, setDetailedExecutions] = useState<DetailedTestExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<DetailedTestExecution | null>(null);

  // Fetch test executions from API
  useEffect(() => {
    const fetchTestExecutions = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching test executions for ${owner}/${repo}`);
        
        const response = await fetch(`/api/test-executions?owner=${owner}&repo=${repo}&detailed=${showDetailed}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error:', errorData);
          throw new Error(`Failed to fetch test executions: ${response.status} ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('Test executions data received:', data);
        
        if (showDetailed) {
          setDetailedExecutions(data.executions || []);
        } else {
          setTestExecutions(data.executions || []);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error fetching test executions:', err);
      } finally {
        setLoading(false);
      }
    };

    if (owner && repo) {
      fetchTestExecutions();
    }
  }, [owner, repo, showDetailed]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/test-executions?owner=${owner}&repo=${repo}&detailed=${showDetailed}`);
      if (response.ok) {
        const data = await response.json();
        if (showDetailed) {
          setDetailedExecutions(data.executions || []);
        } else {
          setTestExecutions(data.executions || []);
        }
      }
    } catch (err) {
      console.error('Error refreshing test executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (execution: TestExecution) => {
    try {
      const response = await fetch(`/api/test-executions?owner=${owner}&repo=${repo}&detailed=true`);
      if (response.ok) {
        const data = await response.json();
        const detailedExecution = data.executions.find((e: DetailedTestExecution) => e.id === execution.id);
        if (detailedExecution) {
          setSelectedExecution(detailedExecution);
        }
      }
    } catch (err) {
      console.error('Error fetching detailed execution:', err);
    }
  };

  const getStatusIcon = (execution: TestExecution) => {
    if (execution.totalErrors === 0 && execution.totalWarnings === 0) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (execution.totalErrors > 0) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (execution: TestExecution) => {
    if (execution.totalErrors === 0 && execution.totalWarnings === 0) {
      return "Passed";
    } else if (execution.totalErrors > 0) {
      return "Failed";
    } else {
      return "Warnings";
    }
  };

  const getStatusColor = (execution: TestExecution) => {
    if (execution.totalErrors === 0 && execution.totalWarnings === 0) {
      return "border-green-500 text-green-500";
    } else if (execution.totalErrors > 0) {
      return "border-red-500 text-red-500";
    } else {
      return "border-yellow-500 text-yellow-500";
    }
  };

  const filteredExecutions = (showDetailed ? detailedExecutions : testExecutions).filter(execution => {
    if (filterStage !== "all" && execution.stage !== filterStage) return false;
    if (filterStatus !== "all") {
      const status = getStatusText(execution);
      if (filterStatus === "passed" && status !== "Passed") return false;
      if (filterStatus === "failed" && status !== "Failed") return false;
      if (filterStatus === "warnings" && status !== "Warnings") return false;
    }
    return true;
  });

  const testStats = [
    { 
      icon: Play, 
      label: "Total Executions", 
      value: testExecutions.length.toString(), 
      color: "text-blue-500" 
    },
    { 
      icon: CheckCircle, 
      label: "Passed", 
      value: testExecutions.filter(t => t.totalErrors === 0 && t.totalWarnings === 0).length.toString(), 
      color: "text-green-500" 
    },
    { 
      icon: XCircle, 
      label: "Failed", 
      value: testExecutions.filter(t => t.totalErrors > 0).length.toString(), 
      color: "text-red-500" 
    },
    { 
      icon: AlertTriangle, 
      label: "Warnings", 
      value: testExecutions.filter(t => t.totalErrors === 0 && t.totalWarnings > 0).length.toString(), 
      color: "text-yellow-500" 
    },
  ];

  const stages = [...new Set(testExecutions.map(execution => execution.stage))];

  if (loading) {
    return (
      <RepoLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading test executions...</span>
          </div>
        </div>
      </RepoLayout>
    );
  }

  if (error) {
    return (
      <RepoLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Error Loading Test Executions</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </RepoLayout>
    );
  }

  return (
    <RepoLayout>
      <div className="mb-8">
        <p className="text-muted-foreground">Test execution history and build analysis</p>
      </div>

      <div className="space-y-8">
        {/* Test Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {testStats.map((stat, index) => (
            <Card key={index} className="p-6 bg-gradient-card border-border/40 hover:border-primary/20 transition-smooth">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Test Executions Timeline */}
        <Card className="p-6 bg-gradient-card border-border/40">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Test Execution Timeline ({filteredExecutions.length})
            </h3>
            <div className="flex gap-2">
              <Dialog open={showFilter} onOpenChange={setShowFilter}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter Test Executions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Stage</label>
                      <Select value={filterStage} onValueChange={setFilterStage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Stages</SelectItem>
                          {stages.map(stage => (
                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="passed">Passed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="warnings">Warnings</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showDetailed"
                        checked={showDetailed}
                        onCheckedChange={(checked) => setShowDetailed(checked as boolean)}
                      />
                      <label
                        htmlFor="showDetailed"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Show detailed view
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFilterStage("all");
                          setFilterStatus("all");
                          setShowDetailed(false);
                        }}
                      >
                        Clear Filters
                      </Button>
                      <Button onClick={() => setShowFilter(false)}>Apply</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredExecutions.length === 0 ? (
              <div className="text-center py-12">
                <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Test Executions Found</h3>
                <p className="text-muted-foreground">
                  Run <code className="bg-muted px-2 py-1 rounded">npx p5 test</code> to start tracking test executions.
                </p>
              </div>
            ) : (
              filteredExecutions.map((execution, index) => (
                <div key={execution.id} className="p-4 rounded-lg bg-background/20 border border-border/20 hover:border-primary/20 transition-smooth">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(execution)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-muted-foreground">{execution.id}</span>
                          <Badge variant="outline" className={getStatusColor(execution)}>
                            {getStatusText(execution)}
                          </Badge>
                          <Badge variant="secondary">
                            {execution.stage}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(execution.executedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{(execution.totalDuration / 1000).toFixed(2)}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {execution.totalErrors > 0 && (
                        <div className="flex items-center gap-1 text-red-500">
                          <Bug className="w-4 h-4" />
                          <span className="text-sm font-medium">{execution.totalErrors} errors</span>
                        </div>
                      )}
                      {execution.totalWarnings > 0 && (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">{execution.totalWarnings} warnings</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(execution)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Detailed Execution Modal */}
        <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Test Execution Details
              </DialogTitle>
            </DialogHeader>
            {selectedExecution && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="font-semibold">{getStatusText(selectedExecution)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="font-semibold">{(selectedExecution.totalDuration / 1000).toFixed(2)}s</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">Errors</div>
                    <div className="font-semibold text-red-500">{selectedExecution.totalErrors}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground">Warnings</div>
                    <div className="font-semibold text-yellow-500">{selectedExecution.totalWarnings}</div>
                  </div>
                </div>

                {selectedExecution.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Errors & Warnings</h4>
                    <div className="space-y-3">
                      {selectedExecution.errors.map((error, index) => (
                        <div key={index} className="p-3 rounded-lg border border-border/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'}>
                              {error.severity}
                            </Badge>
                            <Badge variant="outline">{error.taskName}</Badge>
                            <Badge variant="outline">{error.errorType}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            {error.message}
                          </div>
                          {error.location?.file && (
                            <div className="text-xs text-muted-foreground">
                              {error.location.file}:{error.location.line}:{error.location.column}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-3">Summary by Task</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(selectedExecution.summary.byTask).map(([task, count]) => (
                      <div key={task} className="p-2 rounded bg-muted/50 text-center">
                        <div className="font-semibold">{count}</div>
                        <div className="text-xs text-muted-foreground">{task}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* P5 Test Integration Status */}
        <Card className="p-6 bg-gradient-card border-border/40">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            P5 Test Integration Status
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">Test Execution Tracking</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">Error Analysis & Storage</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">Timeline Visualization</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">Build History Analysis</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">Performance Metrics</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                <span className="text-sm">CLI Integration</span>
                <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </RepoLayout>
  );
};

export default Tests;
