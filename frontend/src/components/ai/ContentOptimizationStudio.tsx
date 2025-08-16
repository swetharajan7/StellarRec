import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
} from '@mui/material';
import {
  Edit,
  Psychology,
  Analytics,
  School,
  TrendingUp,
  CheckCircle,
  Warning,
  Info,
  Lightbulb,
  AutoAwesome,
  ContentCopy,
  Download,
  Refresh,
  ExpandMore,
  Visibility,
  VisibilityOff,
  Compare,
  Star,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import aiIntelligenceService, {
  StudentProfile,
  University,
  ContentOptimization,
  ContentAnalysis,
  OptimizedContent,
  ContentImprovement,
} from '../../services/aiIntelligenceService';

interface ContentOptimizationStudioProps {
  studentProfile: StudentProfile;
  targetUniversities?: University[];
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
      id={`content-tabpanel-${index}`}
      aria-labelledby={`content-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const ContentOptimizationStudio: React.FC<ContentOptimizationStudioProps> = ({
  studentProfile,
  targetUniversities = [],
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [content, setContent] = useState('');
  const [selectedUniversities, setSelectedUniversities] = useState<University[]>([]);
  const [availableUniversities, setAvailableUniversities] = useState<University[]>([]);
  
  // Analysis State
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null);
  const [optimization, setOptimization] = useState<ContentOptimization | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  
  // UI State
  const [showComparison, setShowComparison] = useState(false);
  const [selectedOptimizedVersion, setSelectedOptimizedVersion] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetUniversities.length > 0) {
      setAvailableUniversities(targetUniversities);
      setSelectedUniversities(targetUniversities.slice(0, 3)); // Default to first 3
    } else {
      // Load recommended universities
      loadRecommendedUniversities();
    }
  }, [targetUniversities]);

  const loadRecommendedUniversities = async () => {
    try {
      const recommendations = await aiIntelligenceService.generateUniversityRecommendations(studentProfile);
      const universities = recommendations.slice(0, 10).map(r => r.university);
      setAvailableUniversities(universities);
      setSelectedUniversities(universities.slice(0, 3));
    } catch (error) {
      console.error('Failed to load universities:', error);
    }
  };

  // Debounced content analysis
  const debouncedAnalyzeContent = useCallback(
    debounce(async (text: string) => {
      if (text.length < 50) {
        setContentAnalysis(null);
        return;
      }

      setAnalyzing(true);
      try {
        const analysis = await aiIntelligenceService.analyzeContent(text);
        setContentAnalysis(analysis);
      } catch (error) {
        console.error('Failed to analyze content:', error);
        setError('Failed to analyze content');
      } finally {
        setAnalyzing(false);
      }
    }, 1000),
    []
  );

  useEffect(() => {
    debouncedAnalyzeContent(content);
  }, [content, debouncedAnalyzeContent]);

  const handleOptimizeContent = async () => {
    if (!content || selectedUniversities.length === 0) {
      setError('Please enter content and select universities');
      return;
    }

    setOptimizing(true);
    setError(null);
    
    try {
      const optimizationResult = await aiIntelligenceService.optimizeContent(
        content,
        selectedUniversities,
        studentProfile
      );
      setOptimization(optimizationResult);
      
      // Select first optimized version by default
      const firstUniversityId = Object.keys(optimizationResult.optimizedVersions)[0];
      if (firstUniversityId) {
        setSelectedOptimizedVersion(firstUniversityId);
      }
    } catch (error) {
      console.error('Failed to optimize content:', error);
      setError('Failed to optimize content');
    } finally {
      setOptimizing(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getReadabilityColor = (score: number) => {
    if (score >= 60) return 'success';
    if (score >= 40) return 'warning';
    return 'error';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadContent = (text: string, filename: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom display="flex" alignItems="center">
          <Edit sx={{ mr: 2 }} />
          Content Optimization Studio
        </Typography>
        <Typography variant="body2" color="text.secondary">
          AI-powered content analysis and university-specific optimization
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Content Input */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <Edit sx={{ mr: 1 }} />
                Content Editor
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={12}
                placeholder="Enter your recommendation letter, personal statement, or essay content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  {content.length} characters • {content.split(/\s+/).filter(w => w.length > 0).length} words
                </Typography>
                {analyzing && <CircularProgress size={20} />}
              </Box>

              {/* University Selection */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Target Universities</InputLabel>
                <Select
                  multiple
                  value={selectedUniversities.map(u => u.id)}
                  onChange={(e) => {
                    const selectedIds = e.target.value as string[];
                    const selected = availableUniversities.filter(u => selectedIds.includes(u.id));
                    setSelectedUniversities(selected);
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedUniversities.map((uni) => (
                        <Chip key={uni.id} label={uni.name} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableUniversities.map((university) => (
                    <MenuItem key={university.id} value={university.id}>
                      {university.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<AutoAwesome />}
                onClick={handleOptimizeContent}
                disabled={optimizing || !content || selectedUniversities.length === 0}
              >
                {optimizing ? 'Optimizing...' : 'Optimize with AI'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Analysis Panel */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
                <Tab label="Analysis" icon={<Analytics />} iconPosition="start" />
                <Tab label="Optimization" icon={<Psychology />} iconPosition="start" />
              </Tabs>

              {/* Content Analysis Tab */}
              <TabPanel value={tabValue} index={0}>
                {contentAnalysis ? (
                  <Box>
                    {/* Quality Score */}
                    <Box mb={3}>
                      <Typography variant="h6" gutterBottom>
                        Content Quality Score
                      </Typography>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Box flex={1} mr={2}>
                          <LinearProgress
                            variant="determinate"
                            value={optimization?.qualityScore || 0}
                            color={getQualityScoreColor(optimization?.qualityScore || 0)}
                            sx={{ height: 10, borderRadius: 5 }}
                          />
                        </Box>
                        <Typography variant="h6" fontWeight="bold">
                          {optimization?.qualityScore || '--'}/100
                        </Typography>
                      </Box>
                    </Box>

                    {/* Metrics */}
                    <Grid container spacing={2} mb={3}>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h4">{contentAnalysis.wordCount}</Typography>
                          <Typography variant="body2" color="text.secondary">Words</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h4">{Math.round(contentAnalysis.readabilityScore)}</Typography>
                          <Typography variant="body2" color="text.secondary">Readability</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Chip 
                            label={contentAnalysis.tone} 
                            color={contentAnalysis.tone === 'academic' ? 'success' : 'default'}
                            size="small"
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Tone</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Chip 
                            label={contentAnalysis.sentiment} 
                            color={contentAnalysis.sentiment === 'positive' ? 'success' : 'default'}
                            size="small"
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Sentiment</Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Strengths */}
                    {contentAnalysis.strengths.length > 0 && (
                      <Box mb={2}>
                        <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
                          <CheckCircle color="success" sx={{ mr: 1 }} />
                          Strengths
                        </Typography>
                        <List dense>
                          {contentAnalysis.strengths.map((strength, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <Star color="success" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={strength} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Weaknesses */}
                    {contentAnalysis.weaknesses.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
                          <Warning color="warning" sx={{ mr: 1 }} />
                          Areas for Improvement
                        </Typography>
                        <List dense>
                          {contentAnalysis.weaknesses.map((weakness, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <Warning color="warning" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={weakness} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box textAlign="center" py={4}>
                    <Analytics sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Enter content to see AI analysis
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Minimum 50 characters required
                    </Typography>
                  </Box>
                )}
              </TabPanel>

              {/* Optimization Results Tab */}
              <TabPanel value={tabValue} index={1}>
                {optimization ? (
                  <Box>
                    {/* University Selection for Optimized Versions */}
                    {Object.keys(optimization.optimizedVersions).length > 1 && (
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>View Optimization For</InputLabel>
                        <Select
                          value={selectedOptimizedVersion}
                          onChange={(e) => setSelectedOptimizedVersion(e.target.value)}
                        >
                          {Object.entries(optimization.optimizedVersions).map(([universityId, optimized]) => {
                            const university = selectedUniversities.find(u => u.id === universityId);
                            return (
                              <MenuItem key={universityId} value={universityId}>
                                {university?.name || universityId}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    )}

                    {selectedOptimizedVersion && optimization.optimizedVersions[selectedOptimizedVersion] && (
                      <Box>
                        {/* Optimized Content */}
                        <Box mb={3}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">
                              Optimized Content
                            </Typography>
                            <Box>
                              <Tooltip title="Copy to clipboard">
                                <IconButton 
                                  size="small"
                                  onClick={() => copyToClipboard(optimization.optimizedVersions[selectedOptimizedVersion].content)}
                                >
                                  <ContentCopy />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download">
                                <IconButton 
                                  size="small"
                                  onClick={() => downloadContent(
                                    optimization.optimizedVersions[selectedOptimizedVersion].content,
                                    'optimized-content.txt'
                                  )}
                                >
                                  <Download />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Compare with original">
                                <IconButton 
                                  size="small"
                                  onClick={() => setShowComparison(!showComparison)}
                                >
                                  <Compare />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                          
                          <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                            <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                              {optimization.optimizedVersions[selectedOptimizedVersion].content}
                            </Typography>
                          </Paper>
                        </Box>

                        {/* Optimization Details */}
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle2">
                              Optimization Details
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              {optimization.optimizedVersions[selectedOptimizedVersion].reasoning}
                            </Typography>
                            
                            {/* Changes Made */}
                            <Box mb={2}>
                              <Typography variant="subtitle2" gutterBottom>
                                Changes Made
                              </Typography>
                              <Box display="flex" flexWrap="wrap" gap={0.5}>
                                {optimization.optimizedVersions[selectedOptimizedVersion].keywordOptimization.map((change, idx) => (
                                  <Chip key={idx} label={change} size="small" color="primary" variant="outlined" />
                                ))}
                                {optimization.optimizedVersions[selectedOptimizedVersion].toneAdjustments.map((change, idx) => (
                                  <Chip key={idx} label={change} size="small" color="secondary" variant="outlined" />
                                ))}
                                {optimization.optimizedVersions[selectedOptimizedVersion].culturalAdaptations.map((change, idx) => (
                                  <Chip key={idx} label={change} size="small" color="info" variant="outlined" />
                                ))}
                              </Box>
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </Box>
                    )}

                    {/* General Improvements */}
                    {optimization.improvements.length > 0 && (
                      <Box mt={3}>
                        <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                          <Lightbulb color="primary" sx={{ mr: 1 }} />
                          Improvement Suggestions
                        </Typography>
                        <List>
                          {optimization.improvements.map((improvement, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <Lightbulb 
                                  color={improvement.impact === 'high' ? 'error' : improvement.impact === 'medium' ? 'warning' : 'info'} 
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={improvement.description}
                                secondary={`Impact: ${improvement.impact} • ${improvement.implementation}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Cultural Adaptations */}
                    {optimization.culturalAdaptations.length > 0 && (
                      <Box mt={3}>
                        <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                          <School color="info" sx={{ mr: 1 }} />
                          Cultural Adaptations
                        </Typography>
                        <List>
                          {optimization.culturalAdaptations.map((adaptation, index) => (
                            <ListItem key={index}>
                              <ListItemText
                                primary={`${adaptation.targetCountry}: ${adaptation.adaptationType}`}
                                secondary={adaptation.reasoning}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box textAlign="center" py={4}>
                    <Psychology sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Click "Optimize with AI" to see results
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      AI will analyze and optimize your content for selected universities
                    </Typography>
                  </Box>
                )}
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Comparison Dialog */}
      <Dialog
        open={showComparison}
        onClose={() => setShowComparison(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Content Comparison
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Original Content
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', height: 400, overflow: 'auto' }}>
                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                  {content}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Optimized Content
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'primary.50', height: 400, overflow: 'auto' }}>
                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                  {optimization && selectedOptimizedVersion 
                    ? optimization.optimizedVersions[selectedOptimizedVersion].content
                    : 'No optimization available'
                  }
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparison(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentOptimizationStudio;