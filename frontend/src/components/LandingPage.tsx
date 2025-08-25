import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  School,
  Psychology,
  TrendingUp,
  Speed,
  Star,
  ArrowForward,
  PlayArrow,
  CheckCircle,
  Rocket,
  AutoAwesome,
  Timeline,
  Analytics
} from '@mui/icons-material';

const LandingPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const features = [
    {
      icon: <Psychology />,
      title: 'AI University Matching',
      description: 'Get personalized university recommendations based on your profile, preferences, and success probability.',
      color: '#1976d2'
    },
    {
      icon: <AutoAwesome />,
      title: 'Content Optimization',
      description: 'AI-powered essay and application optimization with real-time feedback and improvement suggestions.',
      color: '#7c4dff'
    },
    {
      icon: <Timeline />,
      title: 'Smart Timeline Management',
      description: 'Intelligent workflow automation with deadline tracking and milestone management.',
      color: '#00acc1'
    },
    {
      icon: <Analytics />,
      title: 'Predictive Analytics',
      description: 'Advanced analytics to predict admission success and optimize your application strategy.',
      color: '#ff7043'
    }
  ];

  const stats = [
    { number: '900+', label: 'Universities Connected', icon: <School /> },
    { number: '95%', label: 'Success Rate Improvement', icon: <TrendingUp /> },
    { number: '60%', label: 'Time Saved', icon: <Speed /> },
    { number: '24/7', label: 'AI Assistance', icon: <Psychology /> }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Stanford University Student',
      avatar: 'SC',
      text: 'StellarRec helped me get into my dream university! The AI recommendations were spot-on.',
      rating: 5
    },
    {
      name: 'Marcus Johnson',
      role: 'MIT Student',
      avatar: 'MJ',
      text: 'The content optimization feature improved my essays dramatically. Highly recommend!',
      rating: 5
    },
    {
      name: 'Emma Rodriguez',
      role: 'Oxford University Student',
      avatar: 'ER',
      text: 'International applications made easy. StellarRec guided me through the entire process.',
      rating: 5
    }
  ];

  return (
    <Box sx={{ overflow: 'hidden' }}>
      {/* Navigation Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          bgcolor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <School sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                StellarRec
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                href="/auth"
                sx={{ textTransform: 'none' }}
              >
                Sign In
              </Button>
              <Button
                variant="contained"
                href="/auth"
                sx={{ textTransform: 'none' }}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 50%, #7c4dff 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          pt: 10,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4rem' },
                  fontWeight: 700,
                  color: 'white',
                  mb: 2,
                  lineHeight: 1.2
                }}
              >
                Transform Your
                <Box component="span" sx={{ display: 'block', color: '#ffeb3b' }}>
                  University Journey
                </Box>
                with AI
              </Typography>
              
              <Typography
                variant="h5"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  mb: 4,
                  fontWeight: 300,
                  lineHeight: 1.4
                }}
              >
                Get personalized recommendations, optimize your applications, and maximize your admission success with our AI-powered platform.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  href="/auth"
                  sx={{
                    bgcolor: '#ffeb3b',
                    color: '#1976d2',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: '#fff59d',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(255,235,59,0.3)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Start Free Today
                </Button>
                
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<PlayArrow />}
                  href="/auth"
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.5)',
                    px: 3,
                    py: 1.5,
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  Watch Demo
                </Button>
              </Box>

              <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} sx={{ color: '#ffeb3b', fontSize: '1.2rem' }} />
                  ))}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Trusted by 10,000+ students worldwide
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: { xs: 300, md: 500 }
                }}
              >
                {/* Animated Dashboard Preview */}
                <Card
                  sx={{
                    width: '100%',
                    maxWidth: 400,
                    bgcolor: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    transform: 'perspective(1000px) rotateY(-5deg) rotateX(5deg)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ bgcolor: '#1976d2', mr: 2 }}>
                        <Psychology />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        AI Dashboard
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        University Match Score
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: '100%',
                            height: 8,
                            bgcolor: '#e0e0e0',
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}
                        >
                          <Box
                            sx={{
                              width: '92%',
                              height: '100%',
                              background: 'linear-gradient(90deg, #4caf50, #8bc34a)',
                              borderRadius: 4
                            }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50' }}>
                          92%
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      {['Stanford', 'MIT', 'Harvard', 'Oxford'].map((uni, index) => (
                        <Grid item xs={6} key={uni}>
                          <Card sx={{ bgcolor: '#f5f5f5', textAlign: 'center', py: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {uni}
                            </Typography>
                            <Typography variant="caption" color="primary">
                              {90 - index * 5}% Match
                            </Typography>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ py: 8, bgcolor: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      mb: 2
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                    {stat.number}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 10 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
              Powerful AI Features
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              Everything you need to succeed in your university applications, powered by cutting-edge artificial intelligence.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
                      borderColor: feature.color
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 60,
                      height: 60,
                      borderRadius: 2,
                      bgcolor: `${feature.color}15`,
                      color: feature.color,
                      mb: 3
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box sx={{ py: 10, bgcolor: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
              Success Stories
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Join thousands of students who achieved their dreams with StellarRec
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={{ height: '100%', p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      {testimonial.avatar}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {testimonial.role}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 2 }}>
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} sx={{ color: '#ffeb3b', fontSize: '1rem' }} />
                    ))}
                  </Box>
                  <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                    "{testimonial.text}"
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: 10,
          background: 'linear-gradient(135deg, #1976d2 0%, #7c4dff 100%)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <Container maxWidth="md">
          <Rocket sx={{ fontSize: 60, mb: 3, opacity: 0.9 }} />
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 3 }}>
            Ready to Transform Your Future?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, lineHeight: 1.6 }}>
            Join thousands of students who are already using StellarRec to achieve their university dreams. Start your journey today with our free plan.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              href="/auth"
              sx={{
                bgcolor: '#ffeb3b',
                color: '#1976d2',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#fff59d',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(255,235,59,0.3)'
                }
              }}
            >
              Get Started Free
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              href="/auth"
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                px: 3,
                py: 1.5,
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Schedule Demo
            </Button>
          </Box>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: '1.2rem' }} />
              <Typography>Free Forever Plan</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: '1.2rem' }} />
              <Typography>No Credit Card Required</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: '1.2rem' }} />
              <Typography>Setup in 2 Minutes</Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;