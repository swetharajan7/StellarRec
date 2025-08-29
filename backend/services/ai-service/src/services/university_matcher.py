import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler, MinMaxScaler
import structlog
from datetime import datetime

logger = structlog.get_logger()

class UniversityMatcher:
    """Advanced university matching algorithm using collaborative and content-based filtering"""
    
    def __init__(self):
        self.tfidf_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.scaler = StandardScaler()
        self.feature_weights = {
            'academic_fit': 0.35,
            'interest_alignment': 0.25,
            'location_preference': 0.15,
            'financial_fit': 0.15,
            'cultural_fit': 0.10
        }
        self.university_data = None
        self.student_profiles = None
        self.similarity_matrix = None
        
    async def initialize(self, university_data: List[Dict], student_profiles: List[Dict] = None):
        """Initialize the matcher with university and student data"""
        logger.info("Initializing University Matcher")
        
        self.university_data = pd.DataFrame(university_data)
        if student_profiles:
            self.student_profiles = pd.DataFrame(student_profiles)
            await self._build_collaborative_model()
        
        await self._preprocess_university_data()
        logger.info(f"University Matcher initialized with {len(university_data)} universities")
    
    async def _preprocess_university_data(self):
        """Preprocess university data for matching"""
        if self.university_data is None:
            return
        
        # Create text features for content-based filtering
        text_features = []
        for _, uni in self.university_data.iterrows():
            # Combine relevant text fields
            text = f"{uni.get('name', '')} {uni.get('location', {}).get('city', '')} "
            text += f"{uni.get('location', {}).get('state', '')} "
            
            # Add program information
            programs = uni.get('programs', [])
            if isinstance(programs, list):
                program_text = ' '.join([p.get('name', '') + ' ' + p.get('department', '') for p in programs])
                text += program_text
            
            # Add ranking and selectivity info
            ranking = uni.get('ranking', {})
            if isinstance(ranking, dict):
                text += f" ranking_{ranking.get('overall', 100)} "
            
            text_features.append(text.strip())
        
        # Create TF-IDF vectors
        if text_features:
            self.university_tfidf = self.tfidf_vectorizer.fit_transform(text_features)
        
        # Normalize numerical features
        numerical_features = []
        for _, uni in self.university_data.iterrows():
            features = [
                uni.get('ranking', {}).get('overall', 100),
                uni.get('metadata', {}).get('acceptance_rate', 0.5),
                uni.get('metadata', {}).get('tuition', 50000),
                uni.get('metadata', {}).get('student_count', 10000)
            ]
            numerical_features.append(features)
        
        if numerical_features:
            self.university_numerical = self.scaler.fit_transform(numerical_features)
    
    async def _build_collaborative_model(self):
        """Build collaborative filtering model from student profiles"""
        if self.student_profiles is None:
            return
        
        # Create student-university interaction matrix
        # This would be based on applications, acceptances, and preferences
        # For now, create a mock similarity matrix
        n_students = len(self.student_profiles)
        n_universities = len(self.university_data) if self.university_data is not None else 0
        
        if n_universities > 0:
            # Mock collaborative filtering matrix
            self.similarity_matrix = np.random.rand(n_students, n_universities)
    
    async def find_matches(
        self, 
        student_profile: Dict[str, Any], 
        max_results: int = 20,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Find university matches for a student"""
        
        if self.university_data is None:
            raise ValueError("University data not initialized")
        
        logger.info(f"Finding matches for student with GPA {student_profile.get('gpa', 'N/A')}")
        
        # Calculate different types of matches
        academic_scores = await self._calculate_academic_fit(student_profile)
        interest_scores = await self._calculate_interest_alignment(student_profile)
        location_scores = await self._calculate_location_preference(student_profile)
        financial_scores = await self._calculate_financial_fit(student_profile)
        cultural_scores = await self._calculate_cultural_fit(student_profile)
        
        # Combine scores with weights
        final_scores = []
        for i in range(len(self.university_data)):
            weighted_score = (
                academic_scores[i] * self.feature_weights['academic_fit'] +
                interest_scores[i] * self.feature_weights['interest_alignment'] +
                location_scores[i] * self.feature_weights['location_preference'] +
                financial_scores[i] * self.feature_weights['financial_fit'] +
                cultural_scores[i] * self.feature_weights['cultural_fit']
            )
            final_scores.append(weighted_score)
        
        # Create match results
        matches = []
        for i, score in enumerate(final_scores):
            university = self.university_data.iloc[i].to_dict()
            
            # Calculate confidence based on data completeness and score consistency
            confidence = await self._calculate_confidence(
                student_profile, university, 
                [academic_scores[i], interest_scores[i], location_scores[i], 
                 financial_scores[i], cultural_scores[i]]
            )
            
            # Determine category
            category = await self._determine_category(student_profile, university, score)
            
            # Generate reasoning
            reasoning = await self._generate_reasoning(
                student_profile, university,
                academic_scores[i], interest_scores[i], location_scores[i],
                financial_scores[i], cultural_scores[i]
            )
            
            match = {
                'university_id': university.get('id'),
                'university_name': university.get('name'),
                'match_percentage': min(100.0, max(0.0, score * 100)),
                'confidence': min(100.0, max(0.0, confidence * 100)),
                'category': category,
                'reasoning': reasoning,
                'factors': [
                    {'factor': 'Academic Fit', 'score': academic_scores[i] * 100, 'weight': self.feature_weights['academic_fit']},
                    {'factor': 'Interest Alignment', 'score': interest_scores[i] * 100, 'weight': self.feature_weights['interest_alignment']},
                    {'factor': 'Location Preference', 'score': location_scores[i] * 100, 'weight': self.feature_weights['location_preference']},
                    {'factor': 'Financial Fit', 'score': financial_scores[i] * 100, 'weight': self.feature_weights['financial_fit']},
                    {'factor': 'Cultural Fit', 'score': cultural_scores[i] * 100, 'weight': self.feature_weights['cultural_fit']}
                ],
                'programs': university.get('programs', []),
                'estimated_cost': await self._estimate_cost(university, student_profile)
            }
            matches.append(match)
        
        # Apply filters
        if filters:
            matches = await self._apply_filters(matches, filters)
        
        # Sort by match percentage and limit results
        matches.sort(key=lambda x: x['match_percentage'], reverse=True)
        return matches[:max_results]
    
    async def _calculate_academic_fit(self, student_profile: Dict[str, Any]) -> List[float]:
        """Calculate academic fit scores for all universities"""
        scores = []
        student_gpa = student_profile.get('gpa', 3.0)
        student_test_scores = student_profile.get('test_scores', {})
        
        for _, university in self.university_data.iterrows():
            score = 0.0
            factors = 0
            
            # GPA comparison
            admission_req = university.get('admission_requirements', {})
            min_gpa = admission_req.get('minGPA', 3.0)
            
            if student_gpa >= min_gpa:
                # Score based on how much above minimum
                gpa_score = min(1.0, student_gpa / min_gpa)
                score += gpa_score * 0.6
            else:
                # Penalty for being below minimum
                gpa_score = student_gpa / min_gpa * 0.5
                score += gpa_score * 0.6
            factors += 0.6
            
            # Test scores comparison
            test_requirements = admission_req.get('testScores', {})
            if student_test_scores and test_requirements:
                test_score = 0.0
                test_factors = 0
                
                # SAT comparison
                if 'SAT' in student_test_scores and 'SAT' in test_requirements:
                    student_sat = student_test_scores['SAT'].get('total', 1200)
                    min_sat = test_requirements['SAT'].get('min', 1200)
                    sat_score = min(1.0, student_sat / min_sat) if min_sat > 0 else 0.8
                    test_score += sat_score
                    test_factors += 1
                
                # GRE comparison
                if 'GRE' in student_test_scores and 'GRE' in test_requirements:
                    student_gre = student_test_scores['GRE'].get('total', 300)
                    min_gre = test_requirements['GRE'].get('min', 300)
                    gre_score = min(1.0, student_gre / min_gre) if min_gre > 0 else 0.8
                    test_score += gre_score
                    test_factors += 1
                
                if test_factors > 0:
                    score += (test_score / test_factors) * 0.4
                    factors += 0.4
            
            # Normalize score
            final_score = score / factors if factors > 0 else 0.5
            scores.append(final_score)
        
        return scores
    
    async def _calculate_interest_alignment(self, student_profile: Dict[str, Any]) -> List[float]:
        """Calculate interest alignment scores"""
        scores = []
        student_interests = student_profile.get('academic_interests', [])
        student_programs = student_profile.get('target_programs', [])
        
        if not student_interests and not student_programs:
            return [0.5] * len(self.university_data)
        
        # Create student interest vector
        student_text = ' '.join(student_interests + student_programs).lower()
        
        for _, university in self.university_data.iterrows():
            score = 0.0
            
            # Program alignment
            programs = university.get('programs', [])
            if programs:
                program_names = [p.get('name', '') for p in programs]
                program_departments = [p.get('department', '') for p in programs]
                uni_text = ' '.join(program_names + program_departments).lower()
                
                # Simple keyword matching (would use more sophisticated NLP in production)
                matches = 0
                total_interests = len(student_interests) + len(student_programs)
                
                for interest in student_interests + student_programs:
                    if interest.lower() in uni_text:
                        matches += 1
                
                if total_interests > 0:
                    score = matches / total_interests
                else:
                    score = 0.5
            else:
                score = 0.3  # Default score when no program data
            
            scores.append(min(1.0, score))
        
        return scores
    
    async def _calculate_location_preference(self, student_profile: Dict[str, Any]) -> List[float]:
        """Calculate location preference scores"""
        scores = []
        location_prefs = student_profile.get('location_preferences', [])
        
        if not location_prefs:
            return [0.7] * len(self.university_data)  # Neutral score when no preference
        
        for _, university in self.university_data.iterrows():
            score = 0.0
            location = university.get('location', {})
            
            uni_city = location.get('city', '').lower()
            uni_state = location.get('state', '').lower()
            uni_country = location.get('country', '').lower()
            
            # Check if any preference matches
            for pref in location_prefs:
                pref_lower = pref.lower()
                if (pref_lower in uni_city or 
                    pref_lower in uni_state or 
                    pref_lower in uni_country):
                    score = 1.0
                    break
            
            # If no exact match, give partial score for same country/region
            if score == 0.0:
                for pref in location_prefs:
                    if 'usa' in pref.lower() or 'united states' in pref.lower():
                        if uni_country == 'usa':
                            score = 0.6
                            break
            
            scores.append(score if score > 0 else 0.3)  # Minimum score for no match
        
        return scores
    
    async def _calculate_financial_fit(self, student_profile: Dict[str, Any]) -> List[float]:
        """Calculate financial fit scores"""
        scores = []
        financial_constraints = student_profile.get('financial_constraints', {})
        
        if not financial_constraints:
            return [0.7] * len(self.university_data)  # Neutral when no constraints
        
        max_budget = financial_constraints.get('max_annual_cost', 100000)
        
        for _, university in self.university_data.iterrows():
            metadata = university.get('metadata', {})
            tuition = metadata.get('tuition', 50000)
            
            if tuition <= max_budget:
                # Score based on how much under budget
                score = 1.0 - (tuition / max_budget) * 0.3  # Higher score for lower cost
            else:
                # Penalty for being over budget
                score = max(0.1, max_budget / tuition)
            
            scores.append(min(1.0, score))
        
        return scores
    
    async def _calculate_cultural_fit(self, student_profile: Dict[str, Any]) -> List[float]:
        """Calculate cultural fit scores"""
        scores = []
        
        # This would use more sophisticated cultural matching in production
        # For now, use a simple heuristic based on university size and type
        
        for _, university in self.university_data.iterrows():
            metadata = university.get('metadata', {})
            student_count = metadata.get('student_count', 10000)
            
            # Score based on university size preference (mock logic)
            if student_count < 5000:
                score = 0.8  # Small school
            elif student_count < 20000:
                score = 0.9  # Medium school
            else:
                score = 0.7  # Large school
            
            scores.append(score)
        
        return scores
    
    async def _calculate_confidence(
        self, 
        student_profile: Dict[str, Any], 
        university: Dict[str, Any], 
        component_scores: List[float]
    ) -> float:
        """Calculate confidence in the match"""
        
        # Base confidence on data completeness
        student_completeness = 0.0
        if student_profile.get('gpa'):
            student_completeness += 0.3
        if student_profile.get('test_scores'):
            student_completeness += 0.3
        if student_profile.get('academic_interests'):
            student_completeness += 0.2
        if student_profile.get('extracurriculars'):
            student_completeness += 0.2
        
        # University data completeness
        uni_completeness = 0.0
        if university.get('admission_requirements'):
            uni_completeness += 0.4
        if university.get('programs'):
            uni_completeness += 0.3
        if university.get('metadata'):
            uni_completeness += 0.3
        
        # Score consistency (lower variance = higher confidence)
        score_variance = np.var(component_scores)
        consistency_factor = max(0.5, 1.0 - score_variance)
        
        # Combine factors
        confidence = (student_completeness + uni_completeness) / 2 * consistency_factor
        return min(1.0, confidence)
    
    async def _determine_category(
        self, 
        student_profile: Dict[str, Any], 
        university: Dict[str, Any], 
        match_score: float
    ) -> str:
        """Determine if university is safety, target, or reach"""
        
        # Get student academic metrics
        student_gpa = student_profile.get('gpa', 3.0)
        
        # Get university selectivity
        metadata = university.get('metadata', {})
        acceptance_rate = metadata.get('acceptance_rate', 0.5)
        
        # Simple categorization logic
        if match_score >= 0.8 and acceptance_rate >= 0.3:
            return 'safety'
        elif match_score >= 0.6 and acceptance_rate >= 0.15:
            return 'target'
        else:
            return 'reach'
    
    async def _generate_reasoning(
        self, 
        student_profile: Dict[str, Any], 
        university: Dict[str, Any],
        academic_score: float,
        interest_score: float,
        location_score: float,
        financial_score: float,
        cultural_score: float
    ) -> Dict[str, str]:
        """Generate human-readable reasoning for the match"""
        
        reasoning = {}
        
        # Academic fit reasoning
        if academic_score >= 0.8:
            reasoning['academic_fit'] = "Your academic credentials align well with this university's standards"
        elif academic_score >= 0.6:
            reasoning['academic_fit'] = "Your academic profile meets the basic requirements"
        else:
            reasoning['academic_fit'] = "Your academic credentials are below the typical admitted student profile"
        
        # Interest alignment reasoning
        if interest_score >= 0.8:
            reasoning['program_alignment'] = "Strong alignment between your interests and available programs"
        elif interest_score >= 0.6:
            reasoning['program_alignment'] = "Good match with several programs offered"
        else:
            reasoning['program_alignment'] = "Limited alignment with your stated interests"
        
        # Location reasoning
        if location_score >= 0.8:
            reasoning['location_preference'] = "Located in your preferred area"
        elif location_score >= 0.6:
            reasoning['location_preference'] = "Reasonable location match"
        else:
            reasoning['location_preference'] = "Not in your preferred location"
        
        # Financial reasoning
        if financial_score >= 0.8:
            reasoning['financial_fit'] = "Well within your budget constraints"
        elif financial_score >= 0.6:
            reasoning['financial_fit'] = "Manageable cost with potential financial aid"
        else:
            reasoning['financial_fit'] = "May require significant financial aid"
        
        return reasoning
    
    async def _estimate_cost(
        self, 
        university: Dict[str, Any], 
        student_profile: Dict[str, Any]
    ) -> Dict[str, float]:
        """Estimate total cost of attendance"""
        
        metadata = university.get('metadata', {})
        base_tuition = metadata.get('tuition', 50000)
        
        # Estimate additional costs
        room_board = base_tuition * 0.3  # Rough estimate
        books_supplies = 2000
        personal_expenses = 3000
        
        total_cost = base_tuition + room_board + books_supplies + personal_expenses
        
        # Estimate potential financial aid (mock calculation)
        estimated_aid = 0
        student_gpa = student_profile.get('gpa', 3.0)
        if student_gpa >= 3.8:
            estimated_aid = total_cost * 0.3  # Merit aid
        elif student_gpa >= 3.5:
            estimated_aid = total_cost * 0.2
        
        net_cost = max(0, total_cost - estimated_aid)
        
        return {
            'tuition': base_tuition,
            'room_board': room_board,
            'books_supplies': books_supplies,
            'personal_expenses': personal_expenses,
            'total_cost': total_cost,
            'estimated_aid': estimated_aid,
            'net_cost': net_cost
        }
    
    async def _apply_filters(
        self, 
        matches: List[Dict[str, Any]], 
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply filters to match results"""
        
        filtered_matches = matches.copy()
        
        # Filter by category
        if 'categories' in filters:
            allowed_categories = filters['categories']
            filtered_matches = [m for m in filtered_matches if m['category'] in allowed_categories]
        
        # Filter by minimum match percentage
        if 'min_match_percentage' in filters:
            min_percentage = filters['min_match_percentage']
            filtered_matches = [m for m in filtered_matches if m['match_percentage'] >= min_percentage]
        
        # Filter by maximum cost
        if 'max_cost' in filters:
            max_cost = filters['max_cost']
            filtered_matches = [
                m for m in filtered_matches 
                if m.get('estimated_cost', {}).get('net_cost', 0) <= max_cost
            ]
        
        return filtered_matches
    
    async def get_similar_universities(
        self, 
        university_id: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Find universities similar to a given university"""
        
        if self.university_data is None or self.university_tfidf is None:
            return []
        
        # Find the target university
        target_uni = self.university_data[self.university_data['id'] == university_id]
        if target_uni.empty:
            return []
        
        target_idx = target_uni.index[0]
        
        # Calculate similarity with all other universities
        target_vector = self.university_tfidf[target_idx]
        similarities = cosine_similarity(target_vector, self.university_tfidf).flatten()
        
        # Get most similar universities (excluding the target itself)
        similar_indices = similarities.argsort()[-limit-1:-1][::-1]
        
        similar_universities = []
        for idx in similar_indices:
            if idx != target_idx:
                uni = self.university_data.iloc[idx].to_dict()
                similar_universities.append({
                    'university_id': uni.get('id'),
                    'university_name': uni.get('name'),
                    'similarity_score': similarities[idx],
                    'programs': uni.get('programs', []),
                    'location': uni.get('location', {})
                })
        
        return similar_universities