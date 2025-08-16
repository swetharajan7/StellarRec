import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  School as SchoolIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { universityIntegrationService } from '../../services/universityIntegrationService';

interface SubmissionStatus {
  universityId: string;
  universityName: string;
  universityCode: string;
  integrationType: string;
  status: 'pending' | 'submitted' | 'processing' | 'delivered' | 'confirmed' | 'failed' | 'retry';
  submittedAt: string;
  confirmedAt?: string;
  errorMessage?: string;
  retryCount?: number;
  nextRetryAt?: string;
  metadata: Record<string, any>;
}

interface SubmissionDashboardProps {
  recommendationId: string;
  onRetrySubmissions?: () => void;
}

export const SubmissionDashboard: React.FC<SubmissionDashboardProps> = ({
  recommendationId,
  onRetrySubmissions
}) => {
  const [submissions, setSubmissions] = useState<SubmissionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load submission status
  const loadSubmissionStatus = async () => {
    try {
      const result = await universityIntegrationService.getSubmissionStatus(recommendationId);
      setSubmissions(result);
    } catch (error) {
      console.error('Failed to load submission status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds for pending submissions
  useEffect(() => {
    loadSubmissionStatus();

    if (autoRefresh) {
      const interval = setInterval(() => {
        const hasPendingSubmissions = submissions.some(s => 
          ['pending', 'submitted', 'processing', 'retry'].includes(s.status)
        );
        
        if (hasPendingSubmissions) {
          loadSubmissionStatus();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [recommendationId, autoRefresh, submissions]);

  // Retry failed submissions
  const handleRetrySubmissions = async () => {
    setRetrying(true);
    try {
      await universityIntegrationService.retryFailedSubmissions(recommendationId);
      await loadSubmissionStatus();
      onRetrySubmissions?.();
    } catch (error) {
      console.error('Failed to retry submissions:', error);
    } finally {
      setRetrying(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: submissions.length,
    successful: submissions.filter(s => ['delivered', 'confirmed'].includes(s.status)).length,
    pending: submissions.filter(s => ['pending', 'submitted', 'processing', 'retry'].includes(s.status)).length,
    failed: submissions.filter(s => s.status === 'failed').length
  };

  const successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      'confirmed': 'success',
      'delivered': 'success',
      'processing': 'info',
      'submitted': 'info',
      'pending': 'warning',
      'retry': 'warning',
      'failed': 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactElement> = {
      'confirmed': <CheckCircleIcon color="success" />,
      'delivered': <CheckCircleIcon color="success" />,
      'processing': <CircularProgress size={20} />,
      'submitted': <CircularProgress size={20} />,
      'pending': <ScheduleIcon color="warning" />,
      'retry': <RefreshIcon color="warning" />,
      'failed': <ErrorIcon color="error" />
    };
    return icons[status] || <ScheduleIcon />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getIntegrationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'commonapp': 'CommonApp',
      'coalition': 'Coalition',
      'uc_system': 'UC System',
      'ouac': 'OUAC',
      'email': 'Email',
      'direct_api': 'Direct API'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Submission Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Track your recommendation submissions across all universities
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SchoolIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="div">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Universities
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="success.main">
                {stats.successful}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Successful
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="warning.main">
                {stats.pending}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SpeedIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="info.main">
                {successRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress Overview */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Overall Progress</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadSubmissionStatus}
                disabled={loading}
              >
                Refresh
              </Button>
              {stats.failed > 0 && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleRetrySubmissions}
                  disabled={retrying}
                  color="warning"
                >
                  Retry Failed ({stats.failed})
                </Button>
              )}
            </Box>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={successRate}
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', typography: 'body2' }}>
            <span>{stats.successful} of {stats.total} completed</span>
            <span>{successRate.toFixed(1)}% success rate</span>
          </Box>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            University Submissions
          </Typography>
          
          <List>
            {submissions.map((submission, index) => (
              <React.Fragment key={submission.universityId}>
                <ListItem
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                >
                  <ListItemIcon>
                    {getStatusIcon(submission.status)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" component="span">
                          {submission.universityName}
                        </Typography>
                        <Chip
                          size="small"
                          label={submission.universityCode}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={getIntegrationTypeLabel(submission.integrationType)}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                          <Chip
                            size="small"
                            label={submission.status.toUpperCase()}
                            color={getStatusColor(submission.status)}
                            variant="filled"
                          />
                          <Typography variant="body2" color="text.secondary">
                            Submitted: {formatDate(submission.submittedAt)}
                          </Typography>
                          {submission.confirmedAt && (
                            <Typography variant="body2" color="success.main">
                              Confirmed: {formatDate(submission.confirmedAt)}
                            </Typography>
                          )}
                        </Box>
                        
                        {submission.errorMessage && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {submission.errorMessage}
                            {submission.retryCount && (
                              <Typography variant="caption" display="block">
                                Retry attempts: {submission.retryCount}
                              </Typography>
                            )}
                          </Alert>
                        )}
                        
                        {submission.nextRetryAt && (
                          <Alert severity="info" sx={{ mt: 1 }}>
                            Next retry scheduled: {formatDate(submission.nextRetryAt)}
                          </Alert>
                        )}
                      </Box>
                    }
                  />
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {submission.metadata?.trackingUrl && (
                      <Tooltip title="Track on University Site">
                        <IconButton
                          size="small"
                          component="a"
                          href={submission.metadata.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <TimelineIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </ListItem>
                
                {index < submissions.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Submission Details Dialog */}
      <Dialog
        open={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Submission Details - {selectedSubmission?.universityName}
        </DialogTitle>
        <DialogContent>
          {selectedSubmission && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    University Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Name:</strong> {selectedSubmission.universityName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Code:</strong> {selectedSubmission.universityCode}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Integration:</strong> {getIntegrationTypeLabel(selectedSubmission.integrationType)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Submission Status
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong> {selectedSubmission.status.toUpperCase()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Submitted:</strong> {formatDate(selectedSubmission.submittedAt)}
                  </Typography>
                  {selectedSubmission.confirmedAt && (
                    <Typography variant="body2">
                      <strong>Confirmed:</strong> {formatDate(selectedSubmission.confirmedAt)}
                    </Typography>
                  )}
                </Grid>
                
                {selectedSubmission.metadata && Object.keys(selectedSubmission.metadata).length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Additional Information
                    </Typography>
                    <Box sx={{ backgroundColor: 'grey.50', p: 2, borderRadius: 1 }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                        {JSON.stringify(selectedSubmission.metadata, null, 2)}
                      </pre>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSubmission(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Auto-refresh indicator */}
      {autoRefresh && stats.pending > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Auto-refreshing every 30 seconds while submissions are pending...
        </Alert>
      )}
    </Container>
  );
};