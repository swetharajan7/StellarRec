import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Link,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Psychology,
  School,
  Person,
  Email,
  Lock,
  Google,
  Apple,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import authService, { LoginCredentials, RegisterData } from '../../services/authService';

interface AuthPageProps {
  onAuthSuccess: () => void;
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
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState<LoginCredentials>({
    email: '',
    password: '',
    rememberMe: false,
  });

  // Register form state
  const [registerData, setRegisterData] = useState<RegisterData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'student',
    schoolCode: '',
    inviteCode: '',
  });

  const [confirmPassword, setConfirmPassword] = useState('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(loginData);
      
      if (response.success) {
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (registerData.password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (registerData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.register(registerData);
      
      if (response.success) {
        setSuccess('Registration successful! Please check your email for verification.');
        setTimeout(() => {
          onAuthSuccess();
        }, 2000);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginData.email) {
      setError('Please enter your email address first');
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(loginData.email);
      setSuccess('Password reset email sent! Check your inbox.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        p: 2,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card sx={{ maxWidth: 500, width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box textAlign="center" mb={3}>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <Psychology sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
                <Typography variant="h4" component="h1" fontWeight="bold">
                  StellarRec
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary">
                AI-Powered University Applications
              </Typography>
            </Box>

            {/* Error/Success Messages */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {/* Tabs */}
            <Tabs value={tabValue} onChange={handleTabChange} centered sx={{ mb: 2 }}>
              <Tab label="Login" />
              <Tab label="Register" />
            </Tabs>

            {/* Login Form */}
            <TabPanel value={tabValue} index={0}>
              <Box component="form" onSubmit={handleLogin}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={loginData.rememberMe}
                        onChange={(e) => setLoginData({ ...loginData, rememberMe: e.target.checked })}
                      />
                    }
                    label="Remember me"
                  />
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </Link>
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mb: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Login'}
                </Button>

                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    or continue with
                  </Typography>
                </Divider>

                <Box display="flex" gap={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Google />}
                    disabled={loading}
                  >
                    Google
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Apple />}
                    disabled={loading}
                  >
                    Apple
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            {/* Register Form */}
            <TabPanel value={tabValue} index={1}>
              <Box component="form" onSubmit={handleRegister}>
                <Box display="flex" gap={2} mb={2}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={registerData.firstName}
                    onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                    required
                  />
                </Box>

                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>I am a...</InputLabel>
                  <Select
                    value={registerData.role}
                    onChange={(e) => setRegisterData({ ...registerData, role: e.target.value as 'student' | 'counselor' })}
                    startAdornment={
                      <InputAdornment position="start">
                        <School />
                      </InputAdornment>
                    }
                  >
                    <MenuItem value="student">Student</MenuItem>
                    <MenuItem value="counselor">School Counselor</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  required
                  sx={{ mb: 2 }}
                  helperText="At least 8 characters with uppercase, lowercase, and number"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  error={confirmPassword !== '' && registerData.password !== confirmPassword}
                  helperText={
                    confirmPassword !== '' && registerData.password !== confirmPassword
                      ? 'Passwords do not match'
                      : ''
                  }
                />

                <Box display="flex" gap={2} mb={3}>
                  <TextField
                    fullWidth
                    label="School Code (Optional)"
                    value={registerData.schoolCode}
                    onChange={(e) => setRegisterData({ ...registerData, schoolCode: e.target.value })}
                    helperText="If your school provided a code"
                  />
                  <TextField
                    fullWidth
                    label="Invite Code (Optional)"
                    value={registerData.inviteCode}
                    onChange={(e) => setRegisterData({ ...registerData, inviteCode: e.target.value })}
                    helperText="Beta access code"
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mb: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Create Account'}
                </Button>

                <Typography variant="body2" color="text.secondary" textAlign="center">
                  By creating an account, you agree to our{' '}
                  <Link href="#" underline="hover">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="#" underline="hover">
                    Privacy Policy
                  </Link>
                </Typography>
              </Box>
            </TabPanel>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};

export default AuthPage;