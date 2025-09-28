'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Zap, Filter, TriangleAlert as AlertTriangle } from "lucide-react";
import { useState } from "react";
import RepoLayout from "@/components/RepoLayout";

const RepoBugs = () => {
  const [showFilter, setShowFilter] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [bugs, setBugs] = useState([
    {
      id: "#127",
      title: "Authentication timeout on mobile devices",
      severity: "critical",
      status: "open",
      assignee: "alex_dev",
      reportedBy: "user_sarah",
      created: "2 hours ago",
      labels: ["auth", "mobile", "timeout"],
      checked: false
    },
    {
      id: "#125",
      title: "Memory leak in dashboard component",
      severity: "high",
      status: "in-progress",
      assignee: "sarah_codes",
      reportedBy: "qa_team",
      created: "1 day ago",
      labels: ["performance", "memory", "dashboard"],
      checked: false
    },
    {
      id: "#123",
      title: "API rate limiting not working correctly",
      severity: "medium",
      status: "open",
      assignee: "mike_builds",
      reportedBy: "dev_mike",
      created: "2 days ago",
      labels: ["api", "rate-limit", "backend"],
      checked: false
    },
    {
      id: "#120",
      title: "Dark mode toggle button placement",
      severity: "low",
      status: "resolved",
      assignee: "jenny_test",
      reportedBy: "user_jen",
      created: "3 days ago",
      labels: ["ui", "dark-mode", "accessibility"],
      checked: false
    },
    {
      id: "#118",
      title: "Form validation errors not displaying",
      severity: "high",
      status: "in-progress",
      assignee: "tom_ui",
      reportedBy: "tester_tom",
      created: "4 days ago",
      labels: ["forms", "validation", "frontend"],
      checked: false
    }
  ]);

  const bugStats = [
    { icon: Bug, label: "Total Issues", value: bugs.length.toString(), color: "text-red-500" },
    { icon: AlertCircle, label: "Critical", value: bugs.filter(b => b.severity === "critical").length.toString(), color: "text-red-600" },
    { icon: Clock, label: "In Progress", value: bugs.filter(b => b.status === "in-progress").length.toString(), color: "text-yellow-500" },
    { icon: CheckCircle, label: "Resolved", value: bugs.filter(b => b.status === "resolved").length.toString(), color: "text-green-500" },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "border-red-500 text-red-500";
      case "in-progress": return "border-yellow-500 text-yellow-500";
      case "resolved": return "border-green-500 text-green-500";
      default: return "border-gray-500 text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "open":
      default:
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  const handleBugCheck = (bugId: string) => {
    setBugs(prevBugs => 
      prevBugs.map(bug => {
        if (bug.id === bugId) {
          let newStatus: string;
          
          switch (bug.status) {
            case "open":
              newStatus = "in-progress";
              break;
            case "in-progress":
              newStatus = "resolved";
              break;
            case "resolved":
              newStatus = "open";
              break;
            default:
              newStatus = "open";
          }
          
          return { ...bug, status: newStatus };
        }
        return bug;
      })
    );
  };

  const filteredBugs = bugs.filter(bug => {
    if (filterPriority !== "all" && bug.severity !== filterPriority) return false;
    if (filterStatus !== "all" && bug.status !== filterStatus) return false;
    if (filterAssignee !== "all" && bug.assignee !== filterAssignee) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created).getTime() - new Date(a.created).getTime();
    if (sortBy === "oldest") return new Date(a.created).getTime() - new Date(b.created).getTime();
    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.severity] || 0) - (priorityOrder[a.severity] || 0);
    }
    return 0;
  });

  const assignees = [...new Set(bugs.map(bug => bug.assignee))];

  return (
    <RepoLayout>
      <div className="mb-8">
        <p className="text-muted-foreground">Issue tracking and bug management</p>
      </div>

        <div className="space-y-8">
          {/* Bug Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bugStats.map((stat, index) => (
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

          {/* Bug List */}
          <Card className="p-6 bg-gradient-card border-border/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bug className="w-5 h-5 text-primary" />
                Issues ({filteredBugs.length})
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
                      <DialogTitle>Filter Issues</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Priority</label>
                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
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
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Assigned To</label>
                        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Assignees</SelectItem>
                            {assignees.map(assignee => (
                              <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Sort By</label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="priority">Priority</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setFilterPriority("all");
                            setFilterStatus("all");
                            setFilterAssignee("all");
                            setSortBy("newest");
                          }}
                        >
                          Clear Filters
                        </Button>
                        <Button onClick={() => setShowFilter(false)}>Apply</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-4">
              {filteredBugs.map((bug, index) => (
                <div key={index} className="p-4 rounded-lg bg-background/20 border border-border/20 hover:border-primary/20 transition-smooth">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div 
                        className="mt-1 cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => handleBugCheck(bug.id)}
                      >
                        {getStatusIcon(bug.status)}
                      </div>
                      <span className="text-sm font-mono text-muted-foreground">{bug.id}</span>
                      <div className={`w-3 h-3 rounded-full ${getSeverityColor(bug.severity)} mt-1`}></div>
                      <h4 className="font-medium">{bug.title}</h4>
                    </div>
                    <Badge variant="outline" className={getStatusColor(bug.status)}>
                      {bug.status.replace('-', ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Reported by {bug.reportedBy}</span>
                      <span>•</span>
                      <span>Assigned to {bug.assignee}</span>
                      <span>•</span>
                      <span>{bug.created}</span>
                    </div>
                    <div className="flex gap-1">
                      {bug.labels.map((label, labelIndex) => (
                        <Badge key={labelIndex} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* P5 Automation Status */}
          <Card className="p-6 bg-gradient-card border-border/40">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              P5 Automation Status
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Build Break Detection</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Auto Test Runner</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Commit Validation</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Auto Bug Tagging</span>
                  <span className="inline-block bg-yellow-500/20 text-yellow-500 px-2 py-1 text-xs rounded">Pending</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Performance Monitoring</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Automated Testing</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
    </RepoLayout>
  );
};

export default RepoBugs;
