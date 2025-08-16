import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  TestTube as TestIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { universityIntegrationService } from '../../services/universityIntegrationService';

interface University {
  id: string;
  name: string;
  code: string;
  country: 'US' | 'CA';
  state?: string;
  province?: string;
  integrationType: string;
  features: {
    realTimeStatus: boolean;
    bulkSubmission: boolean;
    documentUpload: boolean;
    statusWebhooks: boolean;
    customFields: boolean;
  };
  requirements: {
    requiredFields: string[];
    optionalFields: string[];
    maxRecommendationLength: number;
    supportedPrograms: string[];
    deadlineBuffer: number;
  };
  institutionType: string;
  isPublic: boolean;
  websiteUrl: string;
  isActive: boolean;
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
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const UniversityManagementPanel: React.FC = () => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [tabValue, setTabValue] = useState(0);
  const [bulkUploadDialog, setBulkUploadDialog] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState(false);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState('');

  useEffect(() => {
    loadUniversities();
    loadCredentialsStatus();
  }, []);

  const loadUniversities = async () => {
    setLoading(true);
    try {
      const result = await universityIntegrationService.searchUniversities({ limit: 1000 });
      setUniversities(result.universities);
    } catch (error) {
      console.error('Failed to load universities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCredentialsStatus = async () => {
    try {
      const integrationTypes = ['commonapp', 'coalition', 'uc_system', 'ouac'];
      const credentialStatuses: Record<string, any> = {};
      
      for (const type of integrationTypes) {
        try {
          const status = await universityIntegrationService.validateCredentials(type);
          credentialStatuses[type] = status;
        } catch (error) {
          credentialStatuses[type] = { valid: false, error: 'Failed to check' };
        }
      }
      
      setCredentials(credentialStatuses);
    } catch (error) {
      console.error('Failed to load credentials status:', error);
    }
  };

  const handleTestConnection = async (universityId: string) => {
    try {
      setTestResults(prev => ({ ...prev, [universityId]: { testing: true } }));
      const result = await universityIntegrationService.testUniversityConnection(universityId);
      setTestResults(prev => ({ ...prev, [universityId]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [universityId]: { success: false, error: error.message } 
      }));
    }
  };

  const handleUpdateUniversity = async (university: University) => {
    try {
      await universityIntegrationService.updateUniversityIntegration(university.id, university);
      await loadUniversities();
      setEditDialogOpen(false);
      setSelectedUniversity(null);
    } catch (error) {
      console.error('Failed to update university:', error);
    }
  };

  const handleStoreCredentials = async (integrationType: string, credentialData: any) => {
    try {
      await universityIntegrationService.storeCredentials(integrationType, credentialData);
      await loadCredentialsStatus();
      setCredentialsDialog(false);
    } catch (error) {
      console.error('Failed to store credentials:', error);
    }
  };

  const getIntegrationTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      'commonapp': 'primary',
      'coalition': 'success',
      'uc_system': 'warning',
      'ouac': 'error',
      'email': 'secondary',
      'direct_api': 'primary'
    };
    return colors[type] || 'default';
  };

  const getTestStatusIcon = (universityId: string) => {
    const result = testResults[universityId];
    if (!result) return null;
    if (result.testing) return <CircularProgress size={16} />;
    if (result.success) return <CheckCircleIcon color="success" />;
    return <ErrorIcon color="error" />;
  };

  const getCredentialStatusIcon = (type: string) => {
    const status = credentials[type];
    if (!status) return <WarningIcon color="warning" />;
    if (status.valid) return <CheckCircleIcon color="success" />;
    return <ErrorIcon color="error" />;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            University Management
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage university integrations, credentials, and configurations
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadUniversities}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setBulkUploadDialog(true)}
          >
            Bulk Upload
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Universities" />
          <Tab label="Credentials" />
          <Tab label="Rate Limits" />
          <Tab label="Health Monitoring" />
        </Tabs>
      </Box>

      {/* Universities Tab */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              University Integrations ({universities.length})
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>University</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Integration Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Test</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {universities.slice(0, 50).map((university) => (
                      <TableRow key={university.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {university.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {university.institutionType}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={university.code} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {university.state || university.province}, {university.country}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={university.integrationType.replace('_', ' ').toUpperCase()}
                            size="small"
                            color={getIntegrationTypeColor(university.integrationType)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={university.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={university.isActive ? 'success' : 'default'}
                            variant={university.isActive ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleTestConnection(university.id)}
                              disabled={testResults[university.id]?.testing}
                            >
                              <TestIcon />
                            </IconButton>
                            {getTestStatusIcon(university.id)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedUniversity(university);
                              setEditDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Credentials Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {Object.entries(credentials).map(([type, status]) => (
            <Grid item xs={12} md={6} key={type}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      {type.replace('_', ' ').toUpperCase()}
                    </Typography>
                    {getCredentialStatusIcon(type)}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Status: {status?.valid ? 'Valid' : 'Invalid'}
                  </Typography>
                  
                  {status?.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {status.error}
                    </Alert>
                  )}
                  
                  {status?.expiresAt && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Expires: {new Date(status.expiresAt).toLocaleDateString()}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SecurityIcon />}
                      onClick={() => {
                        setSelectedIntegrationType(type);
                        setCredentialsDialog(true);
                      }}
                    >
                      Update
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => universityIntegrationService.rotateCredentials(type)}
                    >
                      Rotate
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Rate Limits Tab */}
      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Rate Limit Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Monitor and manage API rate limits for each integration type.
            </Typography>
            
            <Grid container spacing={3}>
              {['commonapp', 'coalition', 'uc_system', 'ouac'].map((type) => (
                <Grid item xs={12} md={6} key={type}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {type.replace('_', ' ').toUpperCase()}
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Requests per minute: 30/30
                        </Typography>
                        <LinearProgress variant="determinate" value={75} sx={{ mt: 0.5 }} />
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Requests per hour: 450/500
                        </Typography>
                        <LinearProgress variant="determinate" value={90} sx={{ mt: 0.5 }} />
                      </Box>
                      
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => universityIntegrationService.resetRateLimits(type)}
                      >
                        Reset Limits
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Health Monitoring Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Integration Health Status
                </Typography>
                
                <Grid container spacing={2}>
                  {['commonapp', 'coalition', 'uc_system', 'ouac'].map((type) => (
                    <Grid item xs={12} sm={6} key={type}>
                      <Box sx={{ 
                        p: 2, 
                        border: 1, 
                        borderColor: 'divider', 
                        borderRadius: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body1">
                          {type.replace('_', ' ').toUpperCase()}
                        </Typography>
                        <Chip
                          label="Healthy"
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon />}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Metrics
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Response Time
                  </Typography>
                  <Typography variant="h4" color="primary">
                    1.2s
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    98.5%
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Uptime
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    99.9%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Edit University Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit University Integration</DialogTitle>
        <DialogContent>
          {selectedUniversity && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="University Name"
                    value={selectedUniversity.name}
                    onChange={(e) => setSelectedUniversity({
                      ...selectedUniversity,
                      name: e.target.value
                    })}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Integration Type</InputLabel>
                    <Select
                      value={selectedUniversity.integrationType}
                      label="Integration Type"
                      onChange={(e) => setSelectedUniversity({
                        ...selectedUniversity,
                        integrationType: e.target.value
                      })}
                    >
                      <MenuItem value="commonapp">CommonApp</MenuItem>
                      <MenuItem value="coalition">Coalition</MenuItem>
                      <MenuItem value="uc_system">UC System</MenuItem>
                      <MenuItem value="ouac">OUAC</MenuItem>
                      <MenuItem value="direct_api">Direct API</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={selectedUniversity.isActive}
                        onChange={(e) => setSelectedUniversity({
                          ...selectedUniversity,
                          isActive: e.target.checked
                        })}
                      />
                    }
                    label="Active"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Features
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={selectedUniversity.features.realTimeStatus}
                        onChange={(e) => setSelectedUniversity({
                          ...selectedUniversity,
                          features: {
                            ...selectedUniversity.features,
                            realTimeStatus: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Real-time Status"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={selectedUniversity.features.bulkSubmission}
                        onChange={(e) => setSelectedUniversity({
                          ...selectedUniversity,
                          features: {
                            ...selectedUniversity.features,
                            bulkSubmission: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Bulk Submission"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => selectedUniversity && handleUpdateUniversity(selectedUniversity)}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog
        open={credentialsDialog}
        onClose={() => setCredentialsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Credentials - {selectedIntegrationType.toUpperCase()}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="API Key"
              type="password"
              margin="normal"
            />
            <TextField
              fullWidth
              label="Client ID"
              margin="normal"
            />
            <TextField
              fullWidth
              label="Client Secret"
              type="password"
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialsDialog(false)}>Cancel</Button>
          <Button variant="contained">Save Credentials</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};