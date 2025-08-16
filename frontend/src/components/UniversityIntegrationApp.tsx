import React, { useState } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
  Alert
} from '@mui/material';
import {
  School as SchoolIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { UniversitySelectionHub } from './university/UniversitySelectionHub';
import { SubmissionDashboard } from './submission/SubmissionDashboard';
import { IntegrationAnalyticsDashboard } from './analytics/IntegrationAnalyticsDashboard';
import { UniversityManagementPanel } from './admin/UniversityManagementPanel';

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
      id={`nav-tabpanel-${index}`}
      aria-labelledby={`nav-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export const UniversityIntegrationApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedUniversities, setSelectedUniversities] = useState<any[]>([]);
  const [currentRecommendationId, setCurrentRecommendationId] = useState<string>('rec_demo_123');
  const [isAdmin] = useState(true); // In real app, get from auth context

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleUniversitiesSelected = (universities: any[]) => {
    setSelectedUniversities(universities);
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [
      <Link key="home" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
        StellarRec
      </Link>
    ];

    switch (currentTab) {
      case 0:
        breadcrumbs.push(
          <Typography key="universities" color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <SchoolIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            University Selection
          </Typography>
        );
        break;
      case 1:
        breadcrumbs.push(
          <Typography key="dashboard" color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <DashboardIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Submission Dashboard
          </Typography>
        );
        break;
      case 2:
        breadcrumbs.push(
          <Typography key="analytics" color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <AnalyticsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Analytics
          </Typography>
        );
        break;
      case 3:
        breadcrumbs.push(
          <Typography key="admin" color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Administration
          </Typography>
        );
        break;
    }

    return breadcrumbs;
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: 'primary.main' }}>
        <Toolbar>
          <SchoolIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            StellarRec University Integration
          </Typography>
          <Chip
            label="2000+ Universities"
            color="secondary"
            size="small"
            sx={{ mr: 2 }}
          />
          <Button color="inherit">
            Profile
          </Button>
        </Toolbar>
      </AppBar>

      {/* Navigation Tabs */}
      <Paper square elevation={1}>
        <Container maxWidth="xl">
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<SchoolIcon />}
              label="Select Universities"
              id="nav-tab-0"
              aria-controls="nav-tabpanel-0"
            />
            <Tab
              icon={<DashboardIcon />}
              label="Submission Dashboard"
              id="nav-tab-1"
              aria-controls="nav-tabpanel-1"
            />
            <Tab
              icon={<AnalyticsIcon />}
              label="Analytics"
              id="nav-tab-2"
              aria-controls="nav-tabpanel-2"
            />
            {isAdmin && (
              <Tab
                icon={<SettingsIcon />}
                label="Administration"
                id="nav-tab-3"
                aria-controls="nav-tabpanel-3"
              />
            )}
          </Tabs>
        </Container>
      </Paper>

      {/* Breadcrumbs */}
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          {getBreadcrumbs()}
        </Breadcrumbs>
      </Container>

      {/* Status Banner */}
      {selectedUniversities.length > 0 && currentTab !== 0 && (
        <Container maxWidth="xl" sx={{ pb: 2 }}>
          <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2">
              {selectedUniversities.length} universities selected for submission
            </Typography>
            <Button
              size="small"
              sx={{ ml: 2 }}
              onClick={() => setCurrentTab(0)}
            >
              Modify Selection
            </Button>
          </Alert>
        </Container>
      )}

      {/* Tab Panels */}
      <TabPanel value={currentTab} index={0}>
        <UniversitySelectionHub
          onUniversitiesSelected={handleUniversitiesSelected}
          maxSelections={20}
          preselectedUniversities={selectedUniversities}
        />
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <SubmissionDashboard
          recommendationId={currentRecommendationId}
          onRetrySubmissions={() => {
            // Handle retry callback
            console.log('Retrying submissions...');
          }}
        />
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <IntegrationAnalyticsDashboard />
      </TabPanel>

      {isAdmin && (
        <TabPanel value={currentTab} index={3}>
          <UniversityManagementPanel />
        </TabPanel>
      )}

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: 'grey.100',
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            StellarRec University Integration System - Connecting to 2000+ North American Universities
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1 }}>
            Powered by CommonApp, Coalition, UC System, OUAC, and direct university APIs
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};