import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DatePicker,
  LocalizationProvider
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  School as SchoolIcon,
  Public as PublicIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { universityIntegrationService } from '../../services/universityIntegrationService';

interface AnalyticsData {
  integrationStats: any;
  submissionStats: any;
  performanceMetrics: any;
  usageMetrics: any;
  healthStatus: any;
}

export const IntegrationAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });
  const [selectedIntegrationType, setSelectedIntegrationType] = useState('all');

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [
        integrationStats,
        submissionStats,
        performanceMetrics,
        usageMetrics,
        healthStatus
      ] = await Promise.all([
        universityIntegrationService.getIntegrationStatistics(),
        universityIntegrationService.getSubmissionStatistics({
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          integrationType: selectedIntegrationType !== 'all' ? selectedIntegrationType : undefined
        }),
        universityIntegrationService.getPerformanceMetrics(),
        universityIntegrationService.getUsageMetrics(),
        universityIntegrationService.getIntegrationHealth()
      ]);

      setData({
        integrationStats,
        submissionStats,
        performanceMetrics,
        usageMetrics,
        healthStatus
      });
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, selectedIntegrationType]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load analytics data</Alert>
      </Container>
    );
  }

  // Prepare chart data
  const integrationTypeData = Object.entries(data.integrationStats.byIntegrationType).map(([type, count]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    value: count,
    universities: count
  }));

  const submissionByTypeData = Object.entries(data.submissionStats.byIntegrationType).map(([type, stats]: [string, any]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    total: stats.total,
    successful: stats.successful,
    failed: stats.failed,
    successRate: stats.successRate
  }));

  const usageData = Object.entries(data.usageMetrics).map(([type, metrics]: [string, any]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    requests: metrics.requests,
    successRate: metrics.successRate
  }));

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Integration Analytics
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Comprehensive insights into university integration performance
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadAnalyticsData}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Integration Type</InputLabel>
                <Select
                  value={selectedIntegrationType}
                  label="Integration Type"
                  onChange={(e) => setSelectedIntegrationType(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="commonapp">CommonApp</MenuItem>
                  <MenuItem value="coalition">Coalition</MenuItem>
                  <MenuItem value="uc_system">UC System</MenuItem>
                  <MenuItem value="ouac">OUAC</MenuItem>
                  <MenuItem value="direct_api">Direct API</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="From Date"
                    value={dateRange.from}
                    onChange={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="To Date"
                    value={dateRange.to}
                    onChange={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </Box>
              </LocalizationProvider>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SchoolIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="div">
                {data.integrationStats.totalUniversities.toLocaleString()}
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
              <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="success.main">
                {data.submissionStats.successRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SpeedIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="info.main">
                {data.performanceMetrics.averageResponseTime}ms
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Response Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TimelineIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" component="div" color="warning.main">
                {data.performanceMetrics.uptime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                System Uptime
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Universities by Integration Type */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Universities by Integration Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={integrationTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {integrationTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Submission Success Rates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Submission Success Rates by Integration
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={submissionByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successful" stackId="a" fill="#4caf50" name="Successful" />
                  <Bar dataKey="failed" stackId="a" fill="#f44336" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Usage Metrics */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API Usage by Integration Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="Requests"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Health Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Integration Health Status
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body1">Overall Status</Typography>
                  <Chip
                    label={data.healthStatus.overall.toUpperCase()}
                    color={getHealthColor(data.healthStatus.overall)}
                    variant="filled"
                  />
                </Box>
                
                {Object.entries(data.healthStatus.integrations).map(([type, status]: [string, any]) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {type.replace('_', ' ').toUpperCase()}
                    </Typography>
                    <Chip
                      size="small"
                      label={status.toUpperCase()}
                      color={getHealthColor(status)}
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Statistics Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detailed Integration Statistics
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Integration Type</TableCell>
                  <TableCell align="right">Universities</TableCell>
                  <TableCell align="right">Total Submissions</TableCell>
                  <TableCell align="right">Successful</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell align="right">Success Rate</TableCell>
                  <TableCell align="right">Avg Response Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(data.submissionStats.byIntegrationType).map(([type, stats]: [string, any]) => (
                  <TableRow key={type}>
                    <TableCell component="th" scope="row">
                      <Chip
                        label={type.replace('_', ' ').toUpperCase()}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {data.integrationStats.byIntegrationType[type] || 0}
                    </TableCell>
                    <TableCell align="right">{stats.total.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />
                        {stats.successful.toLocaleString()}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <ErrorIcon sx={{ fontSize: 16, color: 'error.main', mr: 0.5 }} />
                        {stats.failed.toLocaleString()}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <LinearProgress
                          variant="determinate"
                          value={stats.successRate}
                          sx={{ width: 60, mr: 1 }}
                        />
                        {stats.successRate.toFixed(1)}%
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {data.usageMetrics[type]?.responseTime || 'N/A'}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
};