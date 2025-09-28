'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SquareCheck as CheckSquare, Square, Clock, User, Plus, Zap, Filter, Calendar, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RepoLayout from "@/components/RepoLayout";

const Tasks = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showFilter, setShowFilter] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [newTaskData, setNewTaskData] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignee: "",
    dueDate: "",
    comments: ""
  });

  const [tasks, setTasks] = useState([
    {
      id: "T-45",
      title: "Implement user authentication flow",
      description: "Set up JWT-based auth with login/register/logout functionality",
      priority: "high",
      status: "in-progress",
      assignee: "alex_dev",
      dueDate: "2024-01-15",
      tags: ["auth", "frontend", "backend"],
      completed: false,
      checked: false
    },
    {
      id: "T-44",
      title: "Design responsive dashboard layout",
      description: "Create mobile-first responsive design for main dashboard",
      priority: "medium",
      status: "todo",
      assignee: "sarah_codes",
      dueDate: "2024-01-18",
      tags: ["ui", "responsive", "design"],
      completed: false,
      checked: false
    },
    {
      id: "T-43",
      title: "Setup CI/CD pipeline",
      description: "Configure GitHub Actions for automated testing and deployment",
      priority: "high",
      status: "completed",
      assignee: "mike_builds",
      dueDate: "2024-01-12",
      tags: ["devops", "ci-cd", "automation"],
      completed: true,
      checked: false
    },
    {
      id: "T-42",
      title: "Optimize database queries",
      description: "Review and optimize slow queries identified in performance monitoring",
      priority: "medium",
      status: "in-progress",
      assignee: "jenny_test",
      dueDate: "2024-01-20",
      tags: ["database", "performance", "optimization"],
      completed: false,
      checked: false
    },
    {
      id: "T-41",
      title: "Write API documentation",
      description: "Document all REST endpoints with examples and response schemas",
      priority: "low",
      status: "todo",
      assignee: "tom_ui",
      dueDate: "2024-01-25",
      tags: ["documentation", "api", "specs"],
      completed: false,
      checked: false
    }
  ]);

  const taskStats = [
    { icon: CheckSquare, label: "Completed", value: tasks.filter(t => t.status === "completed").length.toString(), color: "text-green-500" },
    { icon: Square, label: "Todo", value: tasks.filter(t => t.status === "todo").length.toString(), color: "text-blue-500" },
    { icon: Clock, label: "In Progress", value: tasks.filter(t => t.status === "in-progress").length.toString(), color: "text-yellow-500" },
    { icon: User, label: "Assigned to Me", value: "7", color: "text-purple-500" },
  ];

  const handleTaskClick = (taskId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === taskId) {
          let newStatus: string;
          let newCompleted: boolean;
          
          switch (task.status) {
            case "todo":
              newStatus = "in-progress";
              newCompleted = false;
              break;
            case "in-progress":
              newStatus = "completed";
              newCompleted = true;
              break;
            case "completed":
              newStatus = "todo";
              newCompleted = false;
              break;
            default:
              newStatus = "todo";
              newCompleted = false;
          }
          
          return { ...task, status: newStatus, completed: newCompleted };
        }
        return task;
      })
    );
  };

  const handleTaskCheck = (taskId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === taskId) {
          const newChecked = !task.checked;
          return { ...task, checked: newChecked };
        }
        return task;
      })
    );
  };

  const handleNewTask = () => {
    if (!newTaskData.title.trim()) {
      return;
    }

    const newTask = {
      id: `T-${Math.floor(Math.random() * 1000)}`,
      title: newTaskData.title,
      description: newTaskData.description,
      priority: newTaskData.priority,
      status: "todo",
      assignee: newTaskData.assignee || "unassigned",
      dueDate: newTaskData.dueDate,
      tags: [],
      completed: false,
      checked: false
    };

    setTasks(prevTasks => [newTask, ...prevTasks]);
    setNewTaskData({
      title: "",
      description: "",
      priority: "medium",
      assignee: "",
      dueDate: "",
      comments: ""
    });
    setShowNewTask(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "border-green-500 text-green-500";
      case "in-progress": return "border-yellow-500 text-yellow-500";
      case "todo": return "border-blue-500 text-blue-500";
      default: return "border-gray-500 text-gray-500";
    }
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckSquare className="w-5 h-5 text-green-500" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "todo":
      default:
        return <Square className="w-5 h-5 text-muted-foreground hover:text-primary" />;
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    if (filterAssignee !== "all" && task.assignee !== filterAssignee) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "newest") return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    if (sortBy === "oldest") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (sortBy === "priority") {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return 0;
  });

  const assignees = [...new Set(tasks.map(task => task.assignee))];

  return (
    <RepoLayout>
      <div className="mb-8">
        <p className="text-muted-foreground">Project task management and tracking</p>
      </div>

        <div className="space-y-8">
          {/* Task Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {taskStats.map((stat, index) => (
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

          {/* Task Management */}
          <Card className="p-6 bg-gradient-card border-border/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Project Tasks ({filteredTasks.length})
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
                      <DialogTitle>Filter Tasks</DialogTitle>
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
                            <SelectItem value="todo">Todo</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
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
                            <SelectItem value="newest">Due Date (Newest)</SelectItem>
                            <SelectItem value="oldest">Due Date (Oldest)</SelectItem>
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

                <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Task Title *</Label>
                        <Input
                          id="title"
                          value={newTaskData.title}
                          onChange={(e) => setNewTaskData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter task title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newTaskData.description}
                          onChange={(e) => setNewTaskData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter task description"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority">Priority</Label>
                          <Select value={newTaskData.priority} onValueChange={(value) => setNewTaskData(prev => ({ ...prev, priority: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="assignee">Assignee</Label>
                          <Input
                            id="assignee"
                            value={newTaskData.assignee}
                            onChange={(e) => setNewTaskData(prev => ({ ...prev, assignee: e.target.value }))}
                            placeholder="Enter assignee"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={newTaskData.dueDate}
                          onChange={(e) => setNewTaskData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="comments">Comments</Label>
                        <Textarea
                          id="comments"
                          value={newTaskData.comments}
                          onChange={(e) => setNewTaskData(prev => ({ ...prev, comments: e.target.value }))}
                          placeholder="Additional comments or notes"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowNewTask(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleNewTask}>
                          Create Task
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-4">
              {filteredTasks.map((task, index) => (
                <div key={index} className={`p-4 rounded-lg bg-background/20 border border-border/20 hover:border-primary/20 transition-smooth ${task.completed ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div 
                        className="mt-1 cursor-pointer hover:scale-110 transition-transform" 
                        onClick={() => handleTaskClick(task.id)}
                      >
                        {getTaskIcon(task.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-mono text-muted-foreground">{task.id}</span>
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`}></div>
                          <h4 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Assigned to {task.assignee}</span>
                          <span>•</span>
                          <span>Due {task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status.replace('-', ' ')}
                      </Badge>
                      <div className="flex gap-1">
                        {task.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* P5 Task Automation */}
          <Card className="p-6 bg-gradient-card border-border/40">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              P5 Task Automation
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-background/20 border border-border/20">
                  <h4 className="font-medium mb-2">Auto Task Generation</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Automatically create tasks from commit messages and code comments
                  </p>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="p-4 rounded-lg bg-background/20 border border-border/20">
                  <h4 className="font-medium mb-2">Progress Tracking</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Track task completion based on code changes and PR merges
                  </p>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-background/20 border border-border/20">
                  <h4 className="font-medium mb-2">Deadline Notifications</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Get notified when tasks are approaching their due dates
                  </p>
                  <span className="inline-block bg-yellow-500/20 text-yellow-500 px-2 py-1 text-xs rounded">Pending</span>
                </div>
                <div className="p-4 rounded-lg bg-background/20 border border-border/20">
                  <h4 className="font-medium mb-2">Workload Balancing</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Suggest task assignments based on team member availability
                  </p>
                  <span className="inline-block bg-blue-500/20 text-blue-500 px-2 py-1 text-xs rounded">Coming Soon</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
    </RepoLayout>
  );
};

export default Tasks;

