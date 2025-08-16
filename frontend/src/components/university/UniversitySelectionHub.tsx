import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Chip, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  LinearProgress, 
  Alert,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  School as SchoolIcon,
  Public as PublicIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Remove as RemoveIcon,
  Info as InfoIcon
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
  };
  institutionType: string;
  isPublic: boolean;
  websiteUrl: string;
}

interface UniversitySelectionHubProps {
  onUniversitiesSelected: (universities: University[]) => void;
  maxSelections?: number;
  preselectedUniversities?: University[];
}

export const UniversitySelectionHub: React.FC<UniversitySelectionHubProps> = ({
  onUniversitiesSelected,
  maxSelections = 20,
  preselectedUniversities = []
}) => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [selectedUniversities, setSelectedUniversities] = useState<University[]>(preselectedUniversities);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    country: 'all',
    integrationType: 'all',
    institutionType: 'all',
    isPublic: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    totalUniversities: 0,
    byIntegrationType: {} as Record<string, number>,
    byCountry: {} as Record<string, number>
  });

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (term: string, currentFilters: any) => {
      setLoading(true);
      try {
        const result = await universityIntegrationService.searchUniversities({
          search: term || undefined,
          country: currentFilters.country !== 'all' ? currentFilters.country : undefined,
          integrationType: currentFilters.integrationType !== 'all' ? currentFilters.integrationType : undefined,
          limit: 100
        });
        setUniversities(result.universities);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Load initial data and stats
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [universitiesResult, statsResult] = await Promise.all([
          universityIntegrationService.searchUniversities({ limit: 50 }),
          universityIntegrationService.getIntegrationStatistics()
        ]);
        
        setUniversities(universitiesResult.universities);
        setStats(statsResult);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  // Trigger search when term or filters change
  useEffect(() => {
    debouncedSearch(searchTerm, filters);
  }, [searchTerm, filters, debouncedSearch]);

  // Notify parent when selections change
  useEffect(() => {
    onUniversitiesSelected(selectedUniversities);
  }, [selectedUniversities, onUniversitiesSelected]);

  const handleUniversityToggle = (university: University) => {
    setSelectedUniversities(prev => {
      const isSelected = prev.some(u => u.id === university.id);
      
      if (isSelected) {
        return prev.filter(u => u.id !== university.id);
      } else if (prev.length < maxSelections) {
        return [...prev, university];
      }
      
      return prev;
    });
  };

  const handleRemoveUniversity = (universityId: string) => {
    setSelectedUniversities(prev => prev.filter(u => u.id !== universityId));
  };

  const getIntegrationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'commonapp': '#1976d2',
      'coalition': '#388e3c',
      'uc_system': '#f57c00',
      'ouac': '#d32f2f',
      'email': '#757575',
      'direct_api': '#7b1fa2'
    };
    return colors[type] || '#757575';
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Select Universities
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Choose from {stats.totalUniversities.toLocaleString()}+ universities across North America
        </Typography>
        
        {/* Selection Progress */}
        <Box sx={{ mt: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              {selectedUniversities.length} of {maxSelections} universities selected
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {maxSelections - selectedUniversities.length} remaining
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(selectedUniversities.length / maxSelections) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search universities by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
                fullWidth
              >
                Filters
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              {loading && <LinearProgress />}
            </Grid>
          </Grid>

          {/* Advanced Filters */}
          {showFilters && (
            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={filters.country}
                      label="Country"
                      onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                    >
                      <MenuItem value="all">All Countries</MenuItem>
                      <MenuItem value="US">United States</MenuItem>
                      <MenuItem value="CA">Canada</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Integration Type</InputLabel>
                    <Select
                      value={filters.integrationType}
                      label="Integration Type"
                      onChange={(e) => setFilters(prev => ({ ...prev, integrationType: e.target.value }))}
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
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Institution Type</InputLabel>
                    <Select
                      value={filters.institutionType}
                      label="Institution Type"
                      onChange={(e) => setFilters(prev => ({ ...prev, institutionType: e.target.value }))}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="Private Research University">Private Research</MenuItem>
                      <MenuItem value="Public Research University">Public Research</MenuItem>
                      <MenuItem value="Liberal Arts College">Liberal Arts</MenuItem>
                      <MenuItem value="Community College">Community College</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Public/Private</InputLabel>
                    <Select
                      value={filters.isPublic}
                      label="Public/Private"
                      onChange={(e) => setFilters(prev => ({ ...prev, isPublic: e.target.value }))}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="true">Public</MenuItem>
                      <MenuItem value="false">Private</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Selected Universities */}
      {selectedUniversities.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selected Universities ({selectedUniversities.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedUniversities.map((university) => (
                <Chip
                  key={university.id}
                  label={university.name}
                  onDelete={() => handleRemoveUniversity(university.id)}
                  color="primary"
                  variant="filled"
                  deleteIcon={<RemoveIcon />}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* University Grid */}
      <Grid container spacing={2}>
        {universities.map((university) => {
          const isSelected = selectedUniversities.some(u => u.id === university.id);
          const canSelect = !isSelected && selectedUniversities.length < maxSelections;
          
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={university.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: canSelect || isSelected ? 'pointer' : 'not-allowed',
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  opacity: !canSelect && !isSelected ? 0.6 : 1,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: canSelect || isSelected ? 'translateY(-2px)' : 'none',
                    boxShadow: canSelect || isSelected ? 4 : 1
                  }
                }}
                onClick={() => (canSelect || isSelected) && handleUniversityToggle(university)}
              >
                <CardContent sx={{ p: 2 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" component="h3" sx={{ fontSize: '1rem', lineHeight: 1.2 }}>
                        {university.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {university.code}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <CheckCircleIcon color="primary" sx={{ ml: 1 }} />
                    )}
                  </Box>

                  {/* Location */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PublicIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {university.state || university.province}, {university.country}
                    </Typography>
                  </Box>

                  {/* Institution Type */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {university.isPublic ? 'Public' : 'Private'} • {university.institutionType}
                    </Typography>
                  </Box>

                  {/* Integration Type */}
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      size="small"
                      label={getIntegrationTypeLabel(university.integrationType)}
                      sx={{ 
                        backgroundColor: getIntegrationTypeColor(university.integrationType),
                        color: 'white',
                        fontSize: '0.75rem'
                      }}
                    />
                  </Box>

                  {/* Features */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {university.features.realTimeStatus && (
                      <Tooltip title="Real-time status tracking">
                        <Chip size="small" label="Live Status" variant="outlined" />
                      </Tooltip>
                    )}
                    {university.features.bulkSubmission && (
                      <Tooltip title="Supports bulk submissions">
                        <Chip size="small" label="Bulk Submit" variant="outlined" />
                      </Tooltip>
                    )}
                    {university.features.documentUpload && (
                      <Tooltip title="Document upload supported">
                        <Chip size="small" label="Documents" variant="outlined" />
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Empty State */}
      {universities.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <SchoolIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No universities found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms or filters
          </Typography>
        </Box>
      )}

      {/* Selection Limit Warning */}
      {selectedUniversities.length >= maxSelections && (
        <Alert severity="info" sx={{ mt: 3 }}>
          You've reached the maximum of {maxSelections} universities. Remove some selections to add different ones.
        </Alert>
      )}
    </Container>
  );
};

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}