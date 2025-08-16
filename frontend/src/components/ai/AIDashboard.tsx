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
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Psychology,
  School,
  TrendingUp,
  Assignment,
  Lightbulb,
  Warning,
  CheckCircle,
  Schedule,
  Star,
  Analytics,
  AutoAwesome,
  Refresh,
  Settings,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import aiIntelligenceService, {
  StudentProfile,
  UniversityMatch,
  RealTimeInsights,
  IntelligentWorkflow,
  PortfolioAnalysis,
} from '../../services/aiIntelligenceService';

interface AIDashboardProps {
  studentProfile: StudentProfile;
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
      id={`ai-tabpanel-${index}`}
      aria-labelledby={`ai-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AIDashboard: React.FC<AIDashboardProps> = ({ studentProfile }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // AI Data State
  const [insights, setInsights] = useState<RealTimeInsights | null>(null);
  const [recommendations, setRecommendations] = useState<UniversityMatch[]>([]);
  const [workflow, setWorkflow] = useState<IntelligentWorkflow | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  
  // Error State
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAIData();
  }, [studentProfile]);

  const loadAIData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all AI data in parallel
      const [
        insightsData,
        recommendationsData,
        // portfolioData,
      ] = await Promise.all([
        aiIntelligenceService.getRealTimeInsights(studentProfile.id),
        aiIntelligenceService.generateUniversityRecommendations(studentProfile),
        // aiIntelligenceService.analyzePortfolio(studentProfile, []), // Will populate after recommendations
      ]);

      setInsights(insightsData);
      setRecommendations(recommendationsData);

      // Create workflow if we have recommendations
      if (recommendationsData.length > 0) {
        const workflowData = await aiIntelligenceService.createIntelligentWorkflow(
          studentProfile,
          recommendationsData.slice(0, 10) // Top 10 recommendations
        );
        setWorkflow(workflowData);

        // Analyze portfolio with top universities
        const topUniversities = recommendationsData.slice(0, 15).map(r => r.university);
        const portfolioData = await aiIntelligenceService.analyzePortfolio(
          studentProfile,
          topUniversities
        );
        setPortfolioAnalysis(portfolioData);
      }

    } catch (err) {
      console.error('Failed to load AI data:', err);
      setError('Failed to load AI insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAIData();
    setRefreshing(false);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        flexDirection="column"
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Analyzing your profile with AI...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This may take a few moments
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={loadAIData}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <Psychology />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1">
              AI Intelligence Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Personalized insights and recommendations powered by AI
            </Typography>
          </Box>
        </Box>
        <Box>
          <Tooltip title="Refresh AI Analysis">
            <IconButton onClick={refreshData} disabled={refreshing}>
              <Refresh className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          <Tooltip title="AI Settings">
            <IconButton>
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <School color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {recommendations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      University Matches
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <TrendingUp color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {portfolioAnalysis ? Math.round(portfolioAnalysis.overallSuccessProbability * 100) : '--'}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Success Probability
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Assignment color="info" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {workflow?.automatedTasks.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      AI Tasks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Lightbulb color="warning" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {insights?.opportunities.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Opportunities
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="AI dashboard tabs">
            <Tab 
              label="Insights" 
              icon={<AutoAwesome />} 
              iconPosition="start"
              id="ai-tab-0"
              aria-controls="ai-tabpanel-0"
            />
            <Tab 
              label="University Matches" 
              icon={<School />} 
              iconPosition="start"
              id="ai-tab-1"
              aria-controls="ai-tabpanel-1"
            />
            <Tab 
              label="AI Workflow" 
              icon={<Assignment />} 
              iconPosition="start"
              id="ai-tab-2"
              aria-controls="ai-tabpanel-2"
            />
            <Tab 
              label="Portfolio Analysis" 
              icon={<Analytics />} 
              iconPosition="start"
              id="ai-tab-3"
              aria-controls="ai-tabpanel-3"
            />
          </Tabs>
        </Box>

        {/* Insights Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Opportunities */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                  <Lightbulb color="primary" sx={{ mr: 1 }} />
                  Opportunities
                </Typography>
                <List>
                  {insights?.opportunities.map((opportunity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <ListItem>
                        <ListItemIcon>
                          <Star color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={opportunity} />
                      </ListItem>
                      {index < insights.opportunities.length - 1 && <Divider />}
                    </motion.div>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Risks */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                  <Warning color="warning" sx={{ mr: 1 }} />
                  Areas to Address
                </Typography>
                <List>
                  {insights?.risks.map((risk, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <ListItem>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={risk} />
                      </ListItem>
                      {index < insights.risks.length - 1 && <Divider />}
                    </motion.div>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Recommendations */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                  <Psychology color="primary" sx={{ mr: 1 }} />
                  AI Recommendations
                </Typography>
                <List>
                  {insights?.recommendations.map((recommendation, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary={recommendation} />
                      </ListItem>
                      {index < insights.recommendations.length - 1 && <Divider />}
                    </motion.div>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Market Trends */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                  <TrendingUp color="info" sx={{ mr: 1 }} />
                  Market Trends & Tips
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Market Trends
                    </Typography>
                    {insights?.marketTrends.map((trend, index) => (
                      <Chip
                        key={index}
                        label={trend}
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Personalized Tips
                    </Typography>
                    {insights?.personalizedTips.map((tip, index) => (
                      <Chip
                        key={index}
                        label={tip}
                        variant="outlined"
                        color="primary"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* University Matches Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            {recommendations.slice(0, 12).map((match, index) => (
              <Grid item xs={12} sm={6} md={4} key={match.university.id}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card sx={{ height: '100%', cursor: 'pointer' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Typography variant="h6" component="div" noWrap>
                          {match.university.name}
                        </Typography>
                        <Chip
                          label={`${match.matchScore}%`}
                          color={match.matchScore >= 80 ? 'success' : match.matchScore >= 60 ? 'warning' : 'default'}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {match.university.region}, {match.university.country}
                      </Typography>

                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          Admission Probability
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={match.admissionProbability * 100}
                          color={match.admissionProbability >= 0.7 ? 'success' : match.admissionProbability >= 0.4 ? 'warning' : 'error'}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(match.admissionProbability * 100)}%
                        </Typography>
                      </Box>

                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {match.reasoning.strengths.slice(0, 2).map((strength, idx) => (
                          <Chip
                            key={idx}
                            label={strength}
                            size="small"
                            variant="outlined"
                            color="success"
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* AI Workflow Tab */}
        <TabPanel value={tabValue} index={2}>
          {workflow ? (
            <Grid container spacing={3}>
              {/* Milestones */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Milestones
                  </Typography>
                  <List>
                    {workflow.milestones.map((milestone, index) => (
                      <ListItem key={milestone.milestoneId}>
                        <ListItemIcon>
                          {milestone.status === 'completed' ? (
                            <CheckCircle color="success" />
                          ) : milestone.status === 'in_progress' ? (
                            <Schedule color="primary" />
                          ) : (
                            <Schedule color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={milestone.name}
                          secondary={`Due: ${new Date(milestone.targetDate).toLocaleDateString()}`}
                        />
                        <Box sx={{ minWidth: 35 }}>
                          <Typography variant="body2" color="text.secondary">
                            {milestone.progress}%
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>

              {/* Tasks */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Upcoming Tasks
                  </Typography>
                  <List>
                    {workflow.automatedTasks
                      .filter(task => task.status !== 'completed')
                      .slice(0, 5)
                      .map((task, index) => (
                        <ListItem key={task.taskId}>
                          <ListItemIcon>
                            <Assignment 
                              color={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'primary'} 
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={task.title}
                            secondary={`${task.type} • ${task.estimatedDuration} min`}
                          />
                          <Chip
                            label={task.priority}
                            size="small"
                            color={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'default'}
                          />
                        </ListItem>
                      ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                No workflow created yet
              </Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={loadAIData}>
                Create AI Workflow
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Portfolio Analysis Tab */}
        <TabPanel value={tabValue} index={3}>
          {portfolioAnalysis ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Overall Success Rate
                    </Typography>
                    <Typography variant="h3" color="primary">
                      {Math.round(portfolioAnalysis.overallSuccessProbability * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expected Acceptances: {portfolioAnalysis.expectedAcceptances}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Portfolio Risk
                    </Typography>
                    <Chip
                      label={portfolioAnalysis.portfolioRisk.toUpperCase()}
                      color={
                        portfolioAnalysis.portfolioRisk === 'low' ? 'success' :
                        portfolioAnalysis.portfolioRisk === 'medium' ? 'warning' : 'error'
                      }
                      size="large"
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Optimizations
                    </Typography>
                    <Typography variant="h4">
                      {portfolioAnalysis.optimizations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Improvement suggestions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Optimization Recommendations
                  </Typography>
                  <List>
                    {portfolioAnalysis.optimizations.map((optimization, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Lightbulb color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={optimization} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                Portfolio analysis not available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add university recommendations to analyze your portfolio
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
};

export default AIDashboard;