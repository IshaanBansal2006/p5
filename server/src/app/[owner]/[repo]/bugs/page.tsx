'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bug, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Zap, Filter, TriangleAlert as AlertTriangle, Plus, Loader2, Edit2, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import RepoLayout from "@/components/RepoLayout";
import { ContributorSelect } from "@/components/ui/contributor-select";
import { ContributorDisplay } from "@/components/ui/contributor-display";

// Bug interface definition
interface Bug {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  checked: boolean;
}

const RepoBugs = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showFilter, setShowFilter] = useState(false);
  const [showNewBug, setShowNewBug] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [hideResolved, setHideResolved] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBug, setEditingBug] = useState<string | null>(null);
  const [editBugData, setEditBugData] = useState<Partial<Bug>>({});

  const [newBugData, setNewBugData] = useState({
    title: "",
    description: "",
    severity: "medium",
    assignee: "",
    reporter: "",
    labels: ""
  });

  // Fetch bugs from Redis
  useEffect(() => {
    const fetchBugs = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching bugs for ${owner}/${repo}`);
        const response = await fetch(`/api/addBug?owner=${owner}&repo=${repo}`);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error:', errorData);
          throw new Error(`Failed to fetch bugs: ${response.status} ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Bugs data received:', data);
        setBugs(data.bugs || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error fetching bugs:', err);
      } finally {
        setLoading(false);
      }
    };

    if (owner && repo) {
      fetchBugs();
    }
  }, [owner, repo]);

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
      case "closed": return "border-gray-500 text-gray-500";
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

  const handleNewBug = async () => {
    if (!newBugData.title.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/addBug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          bugs: [{
            title: newBugData.title,
            description: newBugData.description,
            severity: newBugData.severity,
            status: "open",
            assignee: newBugData.assignee || "unassigned",
            reporter: newBugData.reporter || "current_user",
            labels: newBugData.labels ? newBugData.labels.split(',').map(l => l.trim()) : []
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create bug');
      }

      // Refresh bugs from server
      const refreshResponse = await fetch(`/api/addBug?owner=${owner}&repo=${repo}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setBugs(refreshData.bugs || []);
      }

      setNewBugData({
        title: "",
        description: "",
        severity: "medium",
        assignee: "",
        reporter: "",
        labels: ""
      });
      setShowNewBug(false);
    } catch (error) {
      console.error('Error creating bug:', error);
      setError('Failed to create bug');
    }
  };

  const handleEditBug = (bug: Bug) => {
    setEditingBug(bug.id);
    setEditBugData({
      title: bug.title,
      description: bug.description,
      severity: bug.severity,
      status: bug.status,
      assignee: bug.assignee,
      reporter: bug.reporter,
      labels: bug.labels
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBug || !editBugData.title?.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/updateBug', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          bugId: editingBug,
          ...editBugData,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update bug');
      }

      // Update the bug in the local state
      setBugs(prevBugs => 
        prevBugs.map(bug => {
          if (bug.id === editingBug) {
            return { ...bug, ...editBugData, updatedAt: new Date().toISOString() };
          }
          return bug;
        })
      );

      setEditingBug(null);
      setEditBugData({});
    } catch (error) {
      console.error('Error updating bug:', error);
      setError('Failed to update bug');
    }
  };

  const handleCancelEdit = () => {
    setEditingBug(null);
    setEditBugData({});
  };

  const handleBugCheck = (bugId: string) => {
    setBugs(prevBugs => 
      prevBugs.map(bug => {
        if (bug.id === bugId) {
          let newStatus: 'open' | 'in-progress' | 'resolved' | 'closed';
          
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
          
          return { ...bug, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return bug;
      })
    );
  };

  const filteredBugs = bugs.filter(bug => {
    if (filterPriority !== "all" && bug.severity !== filterPriority) return false;
    if (filterStatus !== "all" && bug.status !== filterStatus) return false;
    if (filterAssignee !== "all" && bug.assignee !== filterAssignee) return false;
    if (hideResolved && (bug.status === "resolved" || bug.status === "closed")) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.severity] || 0) - (priorityOrder[a.severity] || 0);
    }
    return 0;
  });

  const assignees = [...new Set(bugs.map(bug => bug.assignee))];

  if (loading) {
    return (
      <RepoLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading bugs...</span>
          </div>
        </div>
      </RepoLayout>
    );
  }

  if (error) {
    return (
      <RepoLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Error Loading Bugs</h2>
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
                            <SelectItem value="closed">Closed</SelectItem>
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
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="hideResolved" 
                          checked={hideResolved}
                          onCheckedChange={(checked) => setHideResolved(checked as boolean)}
                        />
                        <label
                          htmlFor="hideResolved"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Hide resolved bugs
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setFilterPriority("all");
                            setFilterStatus("all");
                            setFilterAssignee("all");
                            setHideResolved(false);
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

                <Dialog open={showNewBug} onOpenChange={setShowNewBug}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Bug
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Report New Bug</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Bug Title *</Label>
                        <Input
                          id="title"
                          value={newBugData.title}
                          onChange={(e) => setNewBugData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter bug title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newBugData.description}
                          onChange={(e) => setNewBugData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the bug in detail"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="severity">Severity</Label>
                          <Select value={newBugData.severity} onValueChange={(value) => setNewBugData(prev => ({ ...prev, severity: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <ContributorSelect
                            value={newBugData.assignee}
                            onChange={(value) => setNewBugData(prev => ({ ...prev, assignee: value }))}
                            placeholder="Select or type assignee"
                            label="Assignee (Optional)"
                            owner={owner as string}
                            repo={repo as string}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="reporter">Reporter</Label>
                        <Input
                          id="reporter"
                          value={newBugData.reporter}
                          onChange={(e) => setNewBugData(prev => ({ ...prev, reporter: e.target.value }))}
                          placeholder="Enter reporter name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="labels">Labels (comma-separated)</Label>
                        <Input
                          id="labels"
                          value={newBugData.labels}
                          onChange={(e) => setNewBugData(prev => ({ ...prev, labels: e.target.value }))}
                          placeholder="e.g., frontend, api, critical"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowNewBug(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleNewBug}>
                          Report Bug
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-4">
              {filteredBugs.map((bug, index) => (
                <div key={index} className={`p-4 rounded-lg bg-background/20 border border-border/20 hover:border-primary/20 transition-smooth ${
                  bug.status === "resolved" || bug.status === "closed" ? "opacity-60" : ""
                }`}>
                  {editingBug === bug.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`edit-title-${bug.id}`}>Title *</Label>
                          <Input
                            id={`edit-title-${bug.id}`}
                            value={editBugData.title || ''}
                            onChange={(e) => setEditBugData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter bug title"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-severity-${bug.id}`}>Severity</Label>
                          <Select 
                            value={editBugData.severity || 'medium'} 
                            onValueChange={(value) => setEditBugData(prev => ({ ...prev, severity: value as 'low' | 'medium' | 'high' | 'critical' }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`edit-description-${bug.id}`}>Description</Label>
                        <Textarea
                          id={`edit-description-${bug.id}`}
                          value={editBugData.description || ''}
                          onChange={(e) => setEditBugData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the bug in detail"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`edit-status-${bug.id}`}>Status</Label>
                          <Select 
                            value={editBugData.status || 'open'} 
                            onValueChange={(value) => setEditBugData(prev => ({ ...prev, status: value as 'open' | 'in-progress' | 'resolved' | 'closed' }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`edit-assignee-${bug.id}`}>Assignee</Label>
                          <Input
                            id={`edit-assignee-${bug.id}`}
                            value={editBugData.assignee || ''}
                            onChange={(e) => setEditBugData(prev => ({ ...prev, assignee: e.target.value }))}
                            placeholder="Enter assignee"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`edit-reporter-${bug.id}`}>Reporter</Label>
                        <Input
                          id={`edit-reporter-${bug.id}`}
                          value={editBugData.reporter || ''}
                          onChange={(e) => setEditBugData(prev => ({ ...prev, reporter: e.target.value }))}
                          placeholder="Enter reporter"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-labels-${bug.id}`}>Labels (comma-separated)</Label>
                        <Input
                          id={`edit-labels-${bug.id}`}
                          value={editBugData.labels?.join(', ') || ''}
                          onChange={(e) => setEditBugData(prev => ({ ...prev, labels: e.target.value.split(',').map(l => l.trim()) }))}
                          placeholder="e.g., frontend, api, critical"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleCancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button onClick={handleSaveEdit}>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
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
                          <h4 className={`font-medium ${bug.status === "resolved" || bug.status === "closed" ? "line-through" : ""}`}>
                            {bug.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusColor(bug.status)}>
                            {bug.status.replace('-', ' ')}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBug(bug)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {bug.description && bug.description.trim() !== ' ' && (
                        <div className={`mb-3 text-sm text-muted-foreground ${bug.status === "resolved" || bug.status === "closed" ? "line-through" : ""}`}>
                          {bug.description}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-4 text-sm text-muted-foreground ${bug.status === "resolved" || bug.status === "closed" ? "line-through" : ""}`}>
                          <span>Reported by {bug.reporter}</span>
                          <span>•</span>
                          <div className="flex items-center gap-2">
                            <span>Assigned to</span>
                            <ContributorDisplay
                              assignee={bug.assignee}
                              owner={owner as string}
                              repo={repo as string}
                            />
                          </div>
                          <span>•</span>
                          <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1">
                          {bug.labels.map((label, labelIndex) => (
                            <Badge key={labelIndex} variant="secondary" className={`text-xs ${bug.status === "resolved" || bug.status === "closed" ? "opacity-60" : ""}`}>
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
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