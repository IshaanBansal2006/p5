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
import { SquareCheck as CheckSquare, Square, Clock, Plus, Zap, Filter, Loader2, Edit2, Save, X, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import RepoLayout from "@/components/RepoLayout";
import { ContributorSelect } from "@/components/ui/contributor-select";
import { ContributorDisplay } from "@/components/ui/contributor-display";
import { TruncatedText } from "@/components/ui/truncated-text";

// Task interface definition
interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in-progress' | 'completed' | 'cancelled';
  assignee: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  comments: TaskComment[];
  completed: boolean;
  checked: boolean;
}

const Tasks = () => {
  const params = useParams();
  const { owner, repo } = params;
  const [showFilter, setShowFilter] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskData, setEditTaskData] = useState<Partial<Task>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [newTaskData, setNewTaskData] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignee: "",
    dueDate: "",
    comments: ""
  });

  // Fetch tasks from Redis
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching tasks for ${owner}/${repo}`);
        const response = await fetch(`/api/addTasks?owner=${owner}&repo=${repo}`);

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error:', errorData);
          throw new Error(`Failed to fetch tasks: ${response.status} ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('Tasks data received:', data);
        
        // Check if the repository exists (has been initialized)
        if (response.status === 404) {
          setError('Repository not found or not initialized with P5');
          return;
        }
        
        setTasks(data.tasks || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    if (owner && repo) {
      fetchTasks();
    }
  }, [owner, repo]);

  const taskStats = [
    { icon: CheckSquare, label: "Completed", value: tasks.filter(t => t.status === "completed").length.toString(), color: "text-green-500" },
    { icon: Square, label: "Todo", value: tasks.filter(t => t.status === "todo").length.toString(), color: "text-blue-500" },
    { icon: Clock, label: "In Progress", value: tasks.filter(t => t.status === "in-progress").length.toString(), color: "text-yellow-500" },
  ];

  const handleTaskClick = async (taskId: string) => {
    // Find the current task to determine new status
    const currentTask = tasks.find(task => task.id === taskId);
    if (!currentTask) return;

    let newStatus: 'todo' | 'in-progress' | 'completed' | 'cancelled';
    let newCompleted: boolean;

    switch (currentTask.status) {
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

    // Optimistically update the UI
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          return { ...task, status: newStatus, completed: newCompleted, updatedAt: new Date().toISOString() };
        }
        return task;
      })
    );

    // Update the task status in Redis
    try {
      const response = await fetch('/api/updateTask', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          taskId,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      // Revert the optimistic update on error
      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.id === taskId) {
            return currentTask; // Revert to original task
          }
          return task;
        })
      );
    }
  };

  const handleNewTask = async () => {
    if (!newTaskData.title.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/addTasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          tasks: [{
            title: newTaskData.title,
            description: newTaskData.description,
            priority: newTaskData.priority,
            status: "todo",
            assignee: newTaskData.assignee || "unassigned",
            dueDate: newTaskData.dueDate,
            tags: newTaskData.comments ? newTaskData.comments.split(',').map(t => t.trim()) : []
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      // Refresh tasks from server
      const refreshResponse = await fetch(`/api/addTasks?owner=${owner}&repo=${repo}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setTasks(refreshData.tasks || []);
      }

      setNewTaskData({
        title: "",
        description: "",
        priority: "medium",
        assignee: "",
        dueDate: "",
        comments: ""
      });
      setShowNewTask(false);
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Failed to create task');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task.id);
    setEditTaskData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      dueDate: task.dueDate,
      tags: task.tags
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editTaskData.title?.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/updateTask', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          taskId: editingTask,
          ...editTaskData,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      // Update the task in the local state
      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.id === editingTask) {
            return { ...task, ...editTaskData, updatedAt: new Date().toISOString() };
          }
          return task;
        })
      );

      setEditingTask(null);
      setEditTaskData({});
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task');
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditTaskData({});
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const response = await fetch('/api/deleteTask', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          taskId: taskToDelete
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Remove the task from local state
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskToDelete));
      
      setShowDeleteConfirm(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    }
  };

  const cancelDeleteTask = () => {
    setShowDeleteConfirm(false);
    setTaskToDelete(null);
  };

  const filteredTasks = tasks.filter(task => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    if (filterAssignee !== "all" && task.assignee !== filterAssignee) return false;
    if (hideCompleted && task.status === "completed") return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    }
    return 0;
  });

  const assignees = [...new Set(tasks.map(task => task.assignee))];

  if (loading) {
    return (
      <RepoLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        </div>
      </RepoLayout>
    );
  }

  if (error) {
    return (
      <RepoLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Error Loading Tasks</h2>
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
        <p className="text-muted-foreground">Project task management and tracking</p>
      </div>

      <div className="space-y-8">
        {/* Task Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Task List */}
        <Card className="p-6 bg-gradient-card border-border/40">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Tasks ({filteredTasks.length})
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
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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
                        id="hideCompleted"
                        checked={hideCompleted}
                        onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
                      />
                      <label
                        htmlFor="hideCompleted"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Hide completed tasks
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFilterPriority("all");
                          setFilterStatus("all");
                          setFilterAssignee("all");
                          setHideCompleted(false);
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
                    Add Task
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
                        placeholder="Describe the task in detail"
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
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <ContributorSelect
                          value={newTaskData.assignee}
                          onChange={(value) => setNewTaskData(prev => ({ ...prev, assignee: value }))}
                          placeholder="Select or type assignee"
                          label="Assignee (Optional)"
                          owner={owner as string}
                          repo={repo as string}
                        />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="dueDate">Due Date (Optional)</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newTaskData.dueDate}
                        onChange={(e) => setNewTaskData(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="comments">Tags (comma-separated)</Label>
                      <Input
                        id="comments"
                        value={newTaskData.comments}
                        onChange={(e) => setNewTaskData(prev => ({ ...prev, comments: e.target.value }))}
                        placeholder="e.g., frontend, api, critical"
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
              <div key={index} className={`p-4 rounded-lg bg-background/20 border border-border/20 hover:border-primary/20 transition-smooth ${task.status === "completed" ? "opacity-60" : ""
                }`}>
                {editingTask === task.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-title-${task.id}`}>Title *</Label>
                        <Input
                          id={`edit-title-${task.id}`}
                          value={editTaskData.title || ''}
                          onChange={(e) => setEditTaskData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter task title"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-priority-${task.id}`}>Priority</Label>
                        <Select
                          value={editTaskData.priority || 'medium'}
                          onValueChange={(value) => setEditTaskData(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' | 'critical' }))}
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
                      <Label htmlFor={`edit-description-${task.id}`}>Description</Label>
                      <Textarea
                        id={`edit-description-${task.id}`}
                        value={editTaskData.description || ''}
                        onChange={(e) => setEditTaskData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the task in detail"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-status-${task.id}`}>Status</Label>
                        <Select
                          value={editTaskData.status || 'todo'}
                          onValueChange={(value) => setEditTaskData(prev => ({ ...prev, status: value as 'todo' | 'in-progress' | 'completed' | 'cancelled' }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">Todo</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`edit-assignee-${task.id}`}>Assignee</Label>
                        <Input
                          id={`edit-assignee-${task.id}`}
                          value={editTaskData.assignee || ''}
                          onChange={(e) => setEditTaskData(prev => ({ ...prev, assignee: e.target.value }))}
                          placeholder="Enter assignee"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-dueDate-${task.id}`}>Due Date</Label>
                        <Input
                          id={`edit-dueDate-${task.id}`}
                          type="date"
                          value={editTaskData.dueDate || ''}
                          onChange={(e) => setEditTaskData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`edit-tags-${task.id}`}>Tags (comma-separated)</Label>
                      <Input
                        id={`edit-tags-${task.id}`}
                        value={editTaskData.tags?.join(', ') || ''}
                        onChange={(e) => setEditTaskData(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()) }))}
                        placeholder="e.g., frontend, api, critical"
                      />
                    </div>
                     <div className="flex gap-2 justify-between">
                       <Button 
                         variant="destructive" 
                         onClick={() => handleDeleteTask(task.id)}
                         className="flex items-center gap-2"
                       >
                         <Trash2 className="w-4 h-4" />
                         Delete Task
                       </Button>
                       <div className="flex gap-2">
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
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-1 cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => handleTaskClick(task.id)}
                        >
                          {task.status === "completed" ? (
                            <CheckSquare className="w-5 h-5 text-green-500" />
                          ) : task.status === "in-progress" ? (
                            <Clock className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <Square className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <span className="text-sm font-mono text-muted-foreground">{task.id}</span>
                        <div className={`w-3 h-3 rounded-full ${task.priority === 'critical' ? 'bg-red-500' :
                          task.priority === 'high' ? 'bg-orange-500' :
                            task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          } mt-1`}></div>
                        <h4 className={`font-medium ${task.status === "completed" ? "line-through" : ""}`}>
                          {task.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          task.status === "completed" ? "border-green-500 text-green-500" :
                            task.status === "in-progress" ? "border-yellow-500 text-yellow-500" :
                              task.status === "cancelled" ? "border-red-500 text-red-500" :
                                "border-blue-500 text-blue-500"
                        }>
                          {task.status.replace('-', ' ')}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {task.description && (
                      <div className="mb-3">
                        <TruncatedText
                          text={task.description}
                          maxLines={3}
                          className={`text-sm text-muted-foreground ${task.status === "completed" ? "line-through" : ""}`}
                          hoverClassName="bg-muted/50 rounded-md p-2 -m-2"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-medium">Assigned to</span>
                          <ContributorDisplay
                            assignee={task.assignee}
                            owner={owner as string}
                            repo={repo as string}
                          />
                        </div>
                        <span>•</span>
                        <span className="text-foreground/80">{new Date(task.createdAt).toLocaleDateString()}</span>
                        {task.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {task.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className={`text-xs ${task.status === "completed" ? "opacity-60" : ""}`}>
                            {tag}
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
                  <span className="text-sm">Task Management</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Bug Detection & AI Processing</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Repository Statistics</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">Devpost Generation</span>
                  <span className="inline-block bg-green-500/20 text-green-500 px-2 py-1 text-xs rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/20">
                  <span className="text-sm">README Sync</span>
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Delete Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this task? This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={cancelDeleteTask}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteTask}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </RepoLayout>
  );
};

export default Tasks;
