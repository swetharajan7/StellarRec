import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Snackbar,
  Fab,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Psychology,
  School,
  Edit,
  Schedule,
  Analytics,
  Settings,
  Notifications,
  Help,
  Logout,
  Person,
  Dashboard,
  AutoAwesome,
  TrendingUp,
  Assignment,
  Close,
  Add,
  Refresh,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import AIDashboard from './AIDashboard';
import SmartUniversityFinder from './SmartUniversityFinder';
import ContentOptimizationStudio from './ContentOptimizationStudio';
import ApplicationTimelineManager from './ApplicationTimelineManager';
import { StudentProfile, UniversityMatch } from '../../services/aiIntelligenceService';

interface AIAppProps {
  initialStudentProfile?: StudentProfile;
  onLogout?: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  badge?: number;
}

// Mock student profile for demo purposes
const mockStudentProfile: StudentProfile = {
  id: 'student_demo_123',
  academic: {
    gpa: 3.85,
    gpaScale: 4.0,
    testScores: {
      sat: { total: 1480, ebrw: 740, math: 740 },
      toefl: { total: 108, reading: 28, listening: 27, speaking: 26, writing: 27 }
    },
    courseRigor: {
      apCourses: 8,
      ibCourses: 0,
      honorsCourses: 6,
      dualEnrollment: 2,
      advancedMath: true,
      advancedScience: true,
      foreignLanguageYears: 4
    },
    currentInstitution: 'Lincoln High School',
    major: 'Computer Science',
    graduationDate: new Date('2024-06-15')
  },
  preferences: {
    location: {
      preferredCountries: ['US', 'CA', 'GB'],
      preferredStates: ['CA', 'NY', 'MA', 'WA'],
      maxDistanceFromHome: 3000,
      urbanPreference: 8
    },
    campusSize: 'large',
    campusType: 'urban',
    climate: 'temperate',
    diversity: 'high',
    socialScene: 'balanced',
    religiousAffiliation: null,
    coed: true
  },
  background: {
    demographics: {
      ethnicity: ['Asian American'],
      firstGeneration: false,
      legacy: false,
      internationalStudent: false,
      countryOfBirth: 'US',
      citizenship: 'US',
      languages: ['English', 'Mandarin', 'Spanish']
    },
    socioeconomic: {
      familyIncome: 95000,
      parentsEducation: ['Bachelor', 'Master'],
      financialAidNeeded: true,
      workStudyInterest: true,
      scholarshipInterest: true
    },
    extracurriculars: [
      {
        name: 'Computer Science Club',
        type: 'academic',
        role: 'President',
        yearsParticipated: 3,
        hoursPerWeek: 6,
        achievements: ['Led team to state programming competition', 'Organized coding bootcamp for underclassmen'],
        leadership: true
      },
      {
        name: 'Varsity Tennis',
        type: 'athletic',
        role: 'Team Captain',
        yearsParticipated: 4,
        hoursPerWeek: 12,
        achievements: ['Regional champion', 'Team MVP 2023'],
        leadership: true
      },
      {
        name: 'National Honor Society',
        type: 'academic',
        role: 'Member',
        yearsParticipated: 2,
        hoursPerWeek: 2,
        achievements: ['Community service coordinator'],
        leadership: false
      }
    ],
    workExperience: [
      {
        employer: 'TechStart Inc.',
        position: 'Software Development Intern',
        startDate: new Date('2023-06-01'),
        endDate: new Date('2023-08-31'),
        hoursPerWeek: 40,
        description: 'Developed web applications using React and Node.js',
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB']
      }
    ],
    volunteering: [
      {
        organization: 'Local Food Bank',
        role: 'Volunteer Coordinator',
        startDate: new Date('2022-01-01'),
        endDate: new Date('2023-12-31'),
        totalHours: 120,
        description: 'Organized food distribution events and managed volunteer schedules',
        impact: 'Helped serve over 500 families in the community'
      }
    ],
    achievements: [
      {
        name: 'National Merit Semifinalist',
        type: 'academic',
        level: 'national',
        date: new Date('2023-09-01'),
        description: 'Recognized for outstanding PSAT performance'
      },
      {
        name: 'Regional Programming Competition - 1st Place',
        type: 'academic',
        level: 'state',
        date: new Date('2023-04-15'),
        description: 'Led team to victory in state-level programming competition'
      }
    ],
    specialCircumstances: []
  },
  goals: {
    intendedMajor: 'Computer Science',
    alternativeMajors: ['Software Engineering', 'Data Science', 'Computer Engineering'],
    careerInterests: ['Software Development', 'Artificial Intelligence', 'Cybersecurity', 'Tech Entrepreneurship'],
    graduateSchoolPlans: true,
    professionalGoals: 'Become a software engineer at a leading tech company and eventually start my own AI-focused startup',
    researchInterests: ['Machine Learning', 'Computer Vision', 'Natural Language Processing', 'Robotics']
  },
  timeline: {
    targetApplicationDate: new Date('2024-01-01'),
    preferredStartDate: new Date('2024-09-01'),
    flexibilityMonths: 0,
    earlyDecisionInterest: true,
    gapYearConsideration: false
  }
};

const AIApp: React.FC<AIAppProps> = ({ initialStudentProfile, onLogout }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(
    initialStudentProfile || mockStudentProfile
  );
  const [currentView, setCurrentView] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Navigation items
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'AI Dashboard',
      icon: <Dashboard />,
      component: AIDashboard,
    },
    {
      id: 'university-finder',
      label: 'Smart University Finder',
      icon: <School />,
      component: SmartUniversityFinder,
    },
    {
      id: 'content-studio',
      label: 'Content Optimization',
      icon: <Edit />,
      component: ContentOptimizationStudio,
    },
    {
      id: 'timeline',
      label: 'Application Timeline',
      icon: <Schedule />,
      component: ApplicationTimelineManager,
      badge: 2, // Overdue tasks
    },
  ];

  useEffect(() => {
    // Auto-close drawer on mobile when view changes
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [currentView, isMobile]);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewChange = (viewId: string) => {
    setCurrentView(viewId);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const getCurrentComponent = () => {
    const currentItem = navigationItems.find(item => item.id === currentView);
    if (!currentItem) return null;

    const Component = currentItem.component;
    return <Component studentProfile={studentProfile} />;
  };

  const drawerWidth = 280;

  const drawer = (
    <Box>
      {/* Logo/Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
          <Psychology />
        </Avatar>
        <Box>
          <Typography variant="h6" noWrap>
            StellarRec AI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Intelligent University Applications
          </Typography>
        </Box>
      </Box>
      
      <Divider />

      {/* Student Profile Summary */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}>
            <Person />
          </Avatar>
          <Box>
            <Typography variant="subtitle2">
              {studentProfile.background.demographics.citizenship} Student
            </Typography>
            <Typography variant="caption" color="text.secondary">
              GPA: {studentProfile.academic.gpa} | SAT: {studentProfile.academic.testScores.sat?.total}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={0.5} flexWrap="wrap">
          <Chip label={studentProfile.goals.intendedMajor} size="small" />
          <Chip label={`${studentProfile.academic.courseRigor.apCourses} APs`} size="small" variant="outlined" />
        </Box>
      </Box>

      <Divider />

      {/* Navigation */}
      <List>
        {navigationItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              selected={currentView === item.id}
              onClick={() => handleViewChange(item.id)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
                  borderRight: 3,
                  borderColor: 'primary.main',
                },
              }}
            >
              <ListItemIcon>
                <Badge badgeContent={item.badge} color="error">
                  {item.icon}
                </Badge>
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Additional Options */}
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => showSnackbar('Analytics coming soon!')}>
            <ListItemIcon>
              <Analytics />
            </ListItemIcon>
            <ListItemText primary="Analytics" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setProfileDialogOpen(true)}>
            <ListItemIcon>
              <Settings />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => showSnackbar('Help center coming soon!')}>
            <ListItemIcon>
              <Help />
            </ListItemIcon>
            <ListItemText primary="Help" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerOpen ? drawerWidth : 0}px)` },
          ml: { md: drawerOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navigationItems.find(item => item.id === currentView)?.label || 'StellarRec AI'}
          </Typography>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Notifications">
              <IconButton color="inherit">
                <Badge badgeContent={notificationCount} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Profile">
              <IconButton
                color="inherit"
                onClick={handleProfileMenuOpen}
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  <Person />
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerOpen ? drawerWidth : 0 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerOpen ? drawerWidth : 0}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {getCurrentComponent()}
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={() => setProfileDialogOpen(true)}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Profile Settings
        </MenuItem>
        <MenuItem onClick={() => showSnackbar('Preferences saved!')}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Preferences
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          if (onLogout) {
            onLogout();
          } else {
            showSnackbar('Logged out successfully!');
          }
        }}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Profile Settings Dialog */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Student Profile Settings
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Intended Major"
                value={studentProfile.goals.intendedMajor}
                onChange={(e) => setStudentProfile({
                  ...studentProfile,
                  goals: { ...studentProfile.goals, intendedMajor: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="GPA"
                type="number"
                value={studentProfile.academic.gpa}
                onChange={(e) => setStudentProfile({
                  ...studentProfile,
                  academic: { ...studentProfile.academic, gpa: parseFloat(e.target.value) }
                })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="SAT Total"
                type="number"
                value={studentProfile.academic.testScores.sat?.total || ''}
                onChange={(e) => setStudentProfile({
                  ...studentProfile,
                  academic: {
                    ...studentProfile.academic,
                    testScores: {
                      ...studentProfile.academic.testScores,
                      sat: {
                        ...studentProfile.academic.testScores.sat!,
                        total: parseInt(e.target.value)
                      }
                    }
                  }
                })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Campus Size Preference</InputLabel>
                <Select
                  value={studentProfile.preferences.campusSize}
                  onChange={(e) => setStudentProfile({
                    ...studentProfile,
                    preferences: { ...studentProfile.preferences, campusSize: e.target.value as any }
                  })}
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="any">Any</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setProfileDialogOpen(false);
              showSnackbar('Profile updated successfully!');
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="AI Assistant"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => showSnackbar('AI Assistant: How can I help you today?')}
      >
        <AutoAwesome />
      </Fab>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => setSnackbarOpen(false)}
          >
            <Close fontSize="small" />
          </IconButton>
        }
      />
    </Box>
  );
};

export default AIApp;