import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
  Avatar,
  Badge,
  Collapse,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Schedule,
  CheckCircle,
  Warning,
  Assignment,
  School,
  Psychology,
  TrendingUp,
  Notifications,
  Edit,
  Delete,
  Add,
  ExpandMore,
  ExpandLess,
  PlayArrow,
  Pause,
  Refresh,
  Analytics,
  AutoAwesome,
  CalendarToday,
  Flag,
  Star,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import aiIntelligenceService, {
  StudentProfile,
  IntelligentWorkflow,
  AutomatedTask,
  WorkflowMilestone,
  UniversityMatch,
} from '../../services/aiIntelligenceService';

interface ApplicationTimelineManagerProps {
  studentProfile: StudentProfile;
  targetUniversities?: UniversityMatch[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`timeline-tabpanel-${index}`}
      aria-labelledby={`timeline-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

interface TaskItemProps {
  task: AutomatedTask;
  onUpdateStatus: (taskId: string, status: string, progress?: number) => void;
  onEdit: (task: AutomatedTask) => void;
  onDelete: (taskId: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdateStatus, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'default';
      case 'skipped': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'in_progress': return <PlayArrow />;
      case 'pending': return <Schedule />;
      case 'skipped': return <Pause />;
      default: return <Schedule />;
    }
  };

  const isOverdue = isAfter(new Date(), new Date(task.scheduledFor)) && task.status !== 'completed';
  const daysUntilDue = differenceInDays(new Date(task.scheduledFor), new Date());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card sx={{ mb: 2, border: isOverdue ? '2px solid' : '1px solid', borderColor: isOverdue ? 'error.main' : 'divider' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
            <Box flex={1}>
              <Typography variant="h6" component="div">
                {task.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {task.description}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  label={task.status.replace('_', ' ')}
                  color={getStatusColor(task.status)}
                  size="small"
                  icon={getStatusIcon(task.status)}
                />
                <Chip
                  label={task.priority}
                  color={getPriorityColor(task.priority)}
                  size="small"
                />
                <Chip
                  label={task.automationLevel}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              {isOverdue && (
                <Tooltip title="Overdue">
                  <Warning color="error" />
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => onEdit(task)}>
                <Edit />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(task.taskId)}>
                <Delete />
              </IconButton>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Due: {format(new Date(task.scheduledFor), 'MMM dd, yyyy')}
                {daysUntilDue >= 0 ? ` (${daysUntilDue} days)` : ` (${Math.abs(daysUntilDue)} days overdue)`}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Estimated: {task.estimatedDuration} minutes
              </Typography>
            </Grid>
          </Grid>

          <Collapse in={expanded}>
            <Box pt={2} borderTop={1} borderColor="divider" mt={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Dependencies
                  </Typography>
                  {task.dependencies.length > 0 ? (
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {task.dependencies.map((dep, idx) => (
                        <Chip key={idx} label={dep} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No dependencies
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Quick Actions
                  </Typography>
                  <Box display="flex" gap={1}>
                    {task.status !== 'completed' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => onUpdateStatus(task.taskId, 'completed', 100)}
                      >
                        Mark Complete
                      </Button>
                    )}
                    {task.status === 'pending' && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onUpdateStatus(task.taskId, 'in_progress', 0)}
                      >
                        Start Task
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ApplicationTimelineManager: React.FC<ApplicationTimelineManagerProps> = ({
  studentProfile,
  targetUniversities = [],
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [workflow, setWorkflow] = useState<IntelligentWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [selectedTask, setSelectedTask] = useState<AutomatedTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadWorkflow();
  }, [studentProfile, targetUniversities]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadWorkflow, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      setError(null);

      let universities = targetUniversities;
      if (universities.length === 0) {
        // Load recommended universities if none provided
        const recommendations = await aiIntelligenceService.generateUniversityRecommendations(studentProfile);
        universities = recommendations.slice(0, 10);
      }

      const workflowData = await aiIntelligenceService.createIntelligentWorkflow(
        studentProfile,
        universities
      );
      setWorkflow(workflowData);
    } catch (err) {
      console.error('Failed to load workflow:', err);
      setError('Failed to load application timeline');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string, progress?: number) => {
    if (!workflow) return;

    try {
      await aiIntelligenceService.updateTaskStatus(workflow.workflowId, taskId, status, progress);
      
      // Update local state
      const updatedTasks = workflow.automatedTasks.map(task =>
        task.taskId === taskId ? { ...task, status: status as any } : task
      );
      setWorkflow({ ...workflow, automatedTasks: updatedTasks });
    } catch (error) {
      console.error('Failed to update task status:', error);
      setError('Failed to update task status');
    }
  };

  const handleEditTask = (task: AutomatedTask) => {
    setSelectedTask(task);
    setShowTaskDialog(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!workflow) return;
    
    // Remove task from local state (in real app, would call API)
    const updatedTasks = workflow.automatedTasks.filter(task => task.taskId !== taskId);
    setWorkflow({ ...workflow, automatedTasks: updatedTasks });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getOverallProgress = () => {
    if (!workflow || workflow.automatedTasks.length === 0) return 0;
    
    const completedTasks = workflow.automatedTasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / workflow.automatedTasks.length) * 100);
  };

  const getUpcomingTasks = () => {
    if (!workflow) return [];
    
    return workflow.automatedTasks
      .filter(task => task.status !== 'completed' && task.status !== 'skipped')
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .slice(0, 5);
  };

  const getOverdueTasks = () => {
    if (!workflow) return [];
    
    return workflow.automatedTasks.filter(task =>
      task.status !== 'completed' &&
      task.status !== 'skipped' &&
      isAfter(new Date(), new Date(task.scheduledFor))
    );
  };

  const getTasksByStatus = (status: string) => {
    if (!workflow) return [];
    return workflow.automatedTasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h4" gutterBottom>
          Application Timeline Manager
        </Typography>
        <Box mt={4}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Creating your intelligent timeline...
          </Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadWorkflow}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!workflow) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" color="text.secondary">
          No workflow available
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={loadWorkflow}>
          Create Timeline
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center">
            <Schedule sx={{ mr: 2 }} />
            Application Timeline Manager
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-powered timeline with smart task management and deadline tracking
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto-refresh"
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadWorkflow}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Progress Overview */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <TrendingUp />
                </Avatar>
                <Box>
                  <Typography variant="h4">{getOverallProgress()}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overall Progress
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={getOverdueTasks().length} color="error">
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <Warning />
                  </Avatar>
                </Badge>
                <Box>
                  <Typography variant="h4">{getUpcomingTasks().length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upcoming Tasks
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h4">{getTasksByStatus('completed').length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed Tasks
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <Flag />
                </Avatar>
                <Box>
                  <Typography variant="h4">{workflow.milestones.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Milestones
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Overdue Tasks Alert */}
      {getOverdueTasks().length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You have {getOverdueTasks().length} overdue task(s). Please review and update your timeline.
        </Alert>
      )}

      {/* Main Content */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Timeline View" icon={<CalendarToday />} iconPosition="start" />
            <Tab label="Task List" icon={<Assignment />} iconPosition="start" />
            <Tab label="Milestones" icon={<Flag />} iconPosition="start" />
            <Tab label="Analytics" icon={<Analytics />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Timeline View */}
        <TabPanel value={tabValue} index={0}>
          <Box p={3}>
            <Timeline>
              {workflow.milestones.map((milestone, index) => (
                <TimelineItem key={milestone.milestoneId}>
                  <TimelineOppositeContent color="text.secondary">
                    {format(new Date(milestone.targetDate), 'MMM dd, yyyy')}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot
                      color={
                        milestone.status === 'completed' ? 'success' :
                        milestone.status === 'in_progress' ? 'primary' :
                        milestone.status === 'overdue' ? 'error' : 'grey'
                      }
                    >
                      {milestone.status === 'completed' ? <CheckCircle /> : <Flag />}
                    </TimelineDot>
                    {index < workflow.milestones.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="h6" component="h3">
                        {milestone.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {milestone.description}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2} mt={1}>
                        <LinearProgress
                          variant="determinate"
                          value={milestone.progress}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="body2">
                          {milestone.progress}%
                        </Typography>
                      </Box>
                      <Box mt={1}>
                        <Chip
                          label={milestone.status.replace('_', ' ')}
                          size="small"
                          color={
                            milestone.status === 'completed' ? 'success' :
                            milestone.status === 'in_progress' ? 'primary' :
                            milestone.status === 'overdue' ? 'error' : 'default'
                          }
                        />
                      </Box>
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </Box>
        </TabPanel>

        {/* Task List */}
        <TabPanel value={tabValue} index={1}>
          <Box p={3}>
            <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
              <Typography variant="h6">
                All Tasks ({workflow.automatedTasks.length})
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showCompletedTasks}
                    onChange={(e) => setShowCompletedTasks(e.target.checked)}
                  />
                }
                label="Show completed"
              />
            </Box>

            <AnimatePresence>
              {workflow.automatedTasks
                .filter(task => showCompletedTasks || task.status !== 'completed')
                .sort((a, b) => {
                  // Sort by priority first, then by due date
                  const priorityOrder = { high: 3, medium: 2, low: 1 };
                  const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
                  const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
                  
                  if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                  }
                  
                  return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
                })
                .map((task) => (
                  <TaskItem
                    key={task.taskId}
                    task={task}
                    onUpdateStatus={handleUpdateTaskStatus}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
            </AnimatePresence>
          </Box>
        </TabPanel>

        {/* Milestones */}
        <TabPanel value={tabValue} index={2}>
          <Box p={3}>
            <Grid container spacing={3}>
              {workflow.milestones.map((milestone) => (
                <Grid item xs={12} md={6} key={milestone.milestoneId}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Typography variant="h6">
                          {milestone.name}
                        </Typography>
                        <Chip
                          label={milestone.status.replace('_', ' ')}
                          color={
                            milestone.status === 'completed' ? 'success' :
                            milestone.status === 'in_progress' ? 'primary' :
                            milestone.status === 'overdue' ? 'error' : 'default'
                          }
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {milestone.description}
                      </Typography>
                      
                      <Typography variant="body2" gutterBottom>
                        Due: {format(new Date(milestone.targetDate), 'MMM dd, yyyy')}
                      </Typography>

                      <Box mb={2}>
                        <LinearProgress
                          variant="determinate"
                          value={milestone.progress}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {milestone.progress}% complete
                        </Typography>
                      </Box>

                      <Typography variant="subtitle2" gutterBottom>
                        Completion Criteria:
                      </Typography>
                      <List dense>
                        {milestone.completionCriteria.map((criteria, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <CheckCircle fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={criteria} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </TabPanel>

        {/* Analytics */}
        <TabPanel value={tabValue} index={3}>
          <Box p={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Task Distribution by Priority
                  </Typography>
                  <Box>
                    {['high', 'medium', 'low'].map((priority) => {
                      const tasks = getTasksByStatus('pending').filter(t => t.priority === priority);
                      const percentage = workflow.automatedTasks.length > 0 
                        ? (tasks.length / workflow.automatedTasks.length) * 100 
                        : 0;
                      
                      return (
                        <Box key={priority} mb={2}>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {priority} Priority
                            </Typography>
                            <Typography variant="body2">
                              {tasks.length} tasks ({Math.round(percentage)}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            color={priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'info'}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Workflow Predictions
                  </Typography>
                  {workflow.predictions && (
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <CalendarToday />
                        </ListItemIcon>
                        <ListItemText
                          primary="Estimated Completion"
                          secondary={format(new Date(workflow.predictions.completionDate), 'MMM dd, yyyy')}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUp />
                        </ListItemIcon>
                        <ListItemText
                          primary="Success Probability"
                          secondary={`${Math.round(workflow.predictions.successProbability * 100)}%`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Warning />
                        </ListItemIcon>
                        <ListItemText
                          primary="Risk Factors"
                          secondary={`${workflow.predictions.riskFactors?.length || 0} identified`}
                        />
                      </ListItem>
                    </List>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Card>

      {/* Task Edit Dialog */}
      <Dialog
        open={showTaskDialog}
        onClose={() => setShowTaskDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Task
        </DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedTask.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTask.description}
              </Typography>
              {/* Add task editing form here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTaskDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApplicationTimelineManager;