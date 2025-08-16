import React, { useState, useEffect, useMemo } from 'react';
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
  Slider,
  Switch,
  FormControlLabel,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Badge,
  Collapse,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Search,
  FilterList,
  School,
  LocationOn,
  AttachMoney,
  TrendingUp,
  Star,
  Favorite,
  FavoriteBorder,
  Compare,
  ExpandMore,
  ExpandLess,
  Psychology,
  Analytics,
  Info,
  Refresh,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import aiIntelligenceService, {
  StudentProfile,
  UniversityMatch,
  University,
  SuccessPrediction,
} from '../../services/aiIntelligenceService';

interface SmartUniversityFinderProps {
  studentProfile: StudentProfile;
}

interface SearchFilters {
  searchQuery: string;
  countries: string[];
  regions: string[];
  campusSize: string[];
  campusType: string[];
  minMatchScore: number;
  minAdmissionProbability: number;
  maxTuitionCost: number;
  majors: string[];
  showOnlyRecommended: boolean;
}

interface UniversityCardProps {
  match: UniversityMatch;
  studentProfile: StudentProfile;
  onFavorite: (universityId: string) => void;
  onCompare: (universityId: string) => void;
  isFavorited: boolean;
  isComparing: boolean;
}

const UniversityCard: React.FC<UniversityCardProps> = ({
  match,
  studentProfile,
  onFavorite,
  onCompare,
  isFavorited,
  isComparing,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [prediction, setPrediction] = useState<SuccessPrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  const loadPrediction = async () => {
    if (prediction) return;
    
    setLoadingPrediction(true);
    try {
      const pred = await aiIntelligenceService.predictAdmissionSuccess(
        studentProfile,
        match.university
      );
      setPrediction(pred);
    } catch (error) {
      console.error('Failed to load prediction:', error);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getAdmissionProbabilityColor = (prob: number) => {
    if (prob >= 0.7) return 'success';
    if (prob >= 0.4) return 'warning';
    return 'error';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        sx={{ 
          height: '100%', 
          cursor: 'pointer',
          border: isComparing ? '2px solid' : '1px solid',
          borderColor: isComparing ? 'primary.main' : 'divider',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
            <Box flex={1}>
              <Typography variant="h6" component="div" noWrap>
                {match.university.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" display="flex" alignItems="center">
                <LocationOn fontSize="small" sx={{ mr: 0.5 }} />
                {match.university.region}, {match.university.country}
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={`${match.matchScore}%`}
                color={getMatchScoreColor(match.matchScore)}
                size="small"
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(match.university.id);
                }}
              >
                {isFavorited ? <Favorite color="error" /> : <FavoriteBorder />}
              </IconButton>
            </Box>
          </Box>

          {/* Admission Probability */}
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Admission Probability
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {Math.round(match.admissionProbability * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={match.admissionProbability * 100}
              color={getAdmissionProbabilityColor(match.admissionProbability)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Key Strengths */}
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Key Strengths
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5}>
              {match.reasoning.strengths.slice(0, 3).map((strength, idx) => (
                <Chip
                  key={idx}
                  label={strength}
                  size="small"
                  variant="outlined"
                  color="success"
                />
              ))}
            </Box>
          </Box>

          {/* Fit Scores */}
          <Grid container spacing={1} mb={2}>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  Academic
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {Math.round(match.academicFit.overallAcademicFit * 100)}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  Cultural
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {Math.round(match.culturalFit.overallCulturalFit * 100)}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  Financial
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {Math.round(match.financialFit.totalCostScore * 100)}%
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Expanded Content */}
          <Collapse in={expanded}>
            <Box pt={2} borderTop={1} borderColor="divider">
              {/* AI Prediction */}
              {!prediction && !loadingPrediction && (
                <Button
                  size="small"
                  startIcon={<Psychology />}
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPrediction();
                  }}
                  sx={{ mb: 2 }}
                >
                  Get AI Prediction
                </Button>
              )}

              {loadingPrediction && (
                <Box mb={2}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="80%" />
                </Box>
              )}

              {prediction && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    AI Prediction Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Key Factors: {prediction.keyFactors.join(', ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Decision Timeline: {new Date(prediction.timeline).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {/* Concerns */}
              {match.reasoning.concerns.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Areas of Concern
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {match.reasoning.concerns.map((concern, idx) => (
                      <Chip
                        key={idx}
                        label={concern}
                        size="small"
                        variant="outlined"
                        color="warning"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Recommendations */}
              {match.recommendations.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    AI Recommendations
                  </Typography>
                  {match.recommendations.slice(0, 3).map((rec, idx) => (
                    <Typography key={idx} variant="body2" color="text.secondary" gutterBottom>
                      • {rec}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Collapse>

          {/* Action Buttons */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Button
              size="small"
              startIcon={<Compare />}
              onClick={(e) => {
                e.stopPropagation();
                onCompare(match.university.id);
              }}
              variant={isComparing ? 'contained' : 'outlined'}
            >
              {isComparing ? 'Comparing' : 'Compare'}
            </Button>
            
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const SmartUniversityFinder: React.FC<SmartUniversityFinderProps> = ({ studentProfile }) => {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<UniversityMatch[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<UniversityMatch[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    searchQuery: '',
    countries: [],
    regions: [],
    campusSize: [],
    campusType: [],
    minMatchScore: 0,
    minAdmissionProbability: 0,
    maxTuitionCost: 100000,
    majors: [],
    showOnlyRecommended: false,
  });

  useEffect(() => {
    loadRecommendations();
  }, [studentProfile]);

  useEffect(() => {
    applyFilters();
  }, [recommendations, filters]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const recs = await aiIntelligenceService.generateUniversityRecommendations(studentProfile);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...recommendations];

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(match =>
        match.university.name.toLowerCase().includes(query) ||
        match.university.region.toLowerCase().includes(query) ||
        match.university.country.toLowerCase().includes(query)
      );
    }

    // Countries
    if (filters.countries.length > 0) {
      filtered = filtered.filter(match =>
        filters.countries.includes(match.university.country)
      );
    }

    // Match score
    filtered = filtered.filter(match =>
      match.matchScore >= filters.minMatchScore
    );

    // Admission probability
    filtered = filtered.filter(match =>
      match.admissionProbability >= filters.minAdmissionProbability / 100
    );

    // Show only recommended
    if (filters.showOnlyRecommended) {
      filtered = filtered.filter(match => match.matchScore >= 70);
    }

    setFilteredRecommendations(filtered);
  };

  const handleFavorite = (universityId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(universityId)) {
      newFavorites.delete(universityId);
    } else {
      newFavorites.add(universityId);
    }
    setFavorites(newFavorites);
  };

  const handleCompare = (universityId: string) => {
    const newComparing = new Set(comparing);
    if (newComparing.has(universityId)) {
      newComparing.delete(universityId);
    } else if (newComparing.size < 3) {
      newComparing.add(universityId);
    }
    setComparing(newComparing);
  };

  const availableCountries = useMemo(() => {
    const countries = new Set(recommendations.map(r => r.university.country));
    return Array.from(countries).sort();
  }, [recommendations]);

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      countries: [],
      regions: [],
      campusSize: [],
      campusType: [],
      minMatchScore: 0,
      minAdmissionProbability: 0,
      maxTuitionCost: 100000,
      majors: [],
      showOnlyRecommended: false,
    });
  };

  if (loading) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Smart University Finder
        </Typography>
        <Grid container spacing={2}>
          {[...Array(6)].map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="80%" height={32} />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={8} sx={{ my: 2 }} />
                  <Box display="flex" gap={1}>
                    <Skeleton variant="rectangular" width={60} height={24} />
                    <Skeleton variant="rectangular" width={80} height={24} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Smart University Finder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-powered university matching based on your profile
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Badge badgeContent={comparing.size} color="primary">
            <Button
              variant="outlined"
              startIcon={<Compare />}
              disabled={comparing.size === 0}
            >
              Compare ({comparing.size})
            </Button>
          </Badge>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadRecommendations}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search universities..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Countries</InputLabel>
                <Select
                  multiple
                  value={filters.countries}
                  onChange={(e) => setFilters({ ...filters, countries: e.target.value as string[] })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableCountries.map((country) => (
                    <MenuItem key={country} value={country}>
                      {country}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Advanced Filters
              </Button>
            </Grid>
          </Grid>

          {/* Advanced Filters */}
          <Collapse in={showFilters}>
            <Box pt={3} borderTop={1} borderColor="divider" mt={2}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Minimum Match Score: {filters.minMatchScore}%
                  </Typography>
                  <Slider
                    value={filters.minMatchScore}
                    onChange={(_, value) => setFilters({ ...filters, minMatchScore: value as number })}
                    min={0}
                    max={100}
                    step={5}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    Minimum Admission Probability: {filters.minAdmissionProbability}%
                  </Typography>
                  <Slider
                    value={filters.minAdmissionProbability}
                    onChange={(_, value) => setFilters({ ...filters, minAdmissionProbability: value as number })}
                    min={0}
                    max={100}
                    step={5}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.showOnlyRecommended}
                        onChange={(e) => setFilters({ ...filters, showOnlyRecommended: e.target.checked })}
                      />
                    }
                    label="Show only recommended (70%+ match)"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Button variant="outlined" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box mb={3}>
        <Alert severity="info" icon={<Psychology />}>
          Showing {filteredRecommendations.length} of {recommendations.length} AI-matched universities
          {favorites.size > 0 && ` • ${favorites.size} favorited`}
          {comparing.size > 0 && ` • ${comparing.size} selected for comparison`}
        </Alert>
      </Box>

      {/* University Grid */}
      <Grid container spacing={3}>
        <AnimatePresence>
          {filteredRecommendations.map((match) => (
            <Grid item xs={12} sm={6} md={4} key={match.university.id}>
              <UniversityCard
                match={match}
                studentProfile={studentProfile}
                onFavorite={handleFavorite}
                onCompare={handleCompare}
                isFavorited={favorites.has(match.university.id)}
                isComparing={comparing.has(match.university.id)}
              />
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>

      {filteredRecommendations.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <School sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No universities match your current filters
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Try adjusting your search criteria or clearing filters
          </Typography>
          <Button variant="contained" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default SmartUniversityFinder;