from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
from datetime import datetime
import structlog

from ..services.model_manager import ModelManager
from ..middleware.auth import get_current_user
from ..utils.cache import get_redis
from ..config import CACHE_CONFIGS

logger = structlog.get_logger()
router = APIRouter()

class StudentProfile(BaseModel):
    """Student profile for university matching"""
    student_id: str
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    test_scores: Dict[str, Any] = Field(default_factory=dict)
    academic_interests: List[str] = Field(default_factory=list)
    target_programs: List[str] = Field(default_factory=list)
    location_preferences: List[str] = Field(default_factory=list)
    financial_constraints: Optional[Dict[str, Any]] = None
    extracurriculars: List[str] = Field(default_factory=list)
    career_goals: List[str] = Field(default_factory=list)

class UniversityMatchRequest(BaseModel):
    """Request for university matching"""
    student_profile: StudentProfile
    max_results: int = Field(default=20, ge=1, le=100)
    include_reach: bool = True
    include_target: bool = True
    include_safety: bool = True
    filters: Optional[Dict[str, Any]] = None

class UniversityMatch(BaseModel):
    """University match result"""
    university_id: str
    university_name: str
    match_percentage: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(..., ge=0.0, le=100.0)
    category: str  # safety, target, reach
    reasoning: Dict[str, Any]
    factors: List[Dict[str, Any]]
    programs: List[Dict[str, Any]]
    estimated_cost: Optional[Dict[str, Any]] = None

class MatchingResponse(BaseModel):
    """Response for university matching"""
    matches: List[UniversityMatch]
    total_matches: int
    processing_time_ms: float
    cached: bool = False
    recommendations: List[str] = Field(default_factory=list)

@router.post("/universities", response_model=MatchingResponse)
async def match_universities(
    request: UniversityMatchRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
) -> MatchingResponse:
    """Match universities based on student profile"""
    
    start_time = datetime.utcnow()
    
    try:
        # Get model manager
        from ..main import app
        model_manager: ModelManager = app.state.model_manager
        
        # Generate cache key
        cache_key = f"matches:{request.student_profile.student_id}:{hash(str(request.dict()))}"
        
        # Check cache first
        redis = await get_redis()
        cached_result = await redis.get(cache_key)
        
        if cached_result:
            logger.info(f"Returning cached university matches for student {request.student_profile.student_id}")
            result = MatchingResponse.parse_raw(cached_result)
            result.cached = True
            return result
        
        # Get university matching model
        matching_model = await model_manager.get_model("university_matcher")
        if not matching_model:
            raise HTTPException(status_code=503, detail="University matching model not available")
        
        # Perform matching
        matches = await _perform_university_matching(matching_model, request)
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Create response
        response = MatchingResponse(
            matches=matches,
            total_matches=len(matches),
            processing_time_ms=processing_time,
            recommendations=_generate_recommendations(matches)
        )
        
        # Cache result
        background_tasks.add_task(
            _cache_matching_result,
            cache_key,
            response.json(),
            CACHE_CONFIGS["university_matches"]["ttl"]
        )
        
        # Log matching event
        logger.info(
            f"Generated {len(matches)} university matches for student {request.student_profile.student_id}",
            processing_time_ms=processing_time
        )
        
        return response
        
    except Exception as e:
        logger.error(f"University matching failed: {e}")
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")

async def _perform_university_matching(
    model: Dict[str, Any], 
    request: UniversityMatchRequest
) -> List[UniversityMatch]:
    """Perform the actual university matching logic using the UniversityMatcher"""
    
    from ..services.university_matcher import UniversityMatcher
    
    # Initialize the matcher with mock university data
    # In production, this would load from database
    mock_universities = [
        {
            "id": "mit-001",
            "name": "Massachusetts Institute of Technology",
            "location": {"city": "Cambridge", "state": "Massachusetts", "country": "USA"},
            "ranking": {"overall": 1, "engineering": 1, "computerScience": 1},
            "admission_requirements": {
                "minGPA": 3.7,
                "testScores": {"SAT": {"min": 1500, "max": 1600}, "GRE": {"min": 320, "max": 340}}
            },
            "programs": [
                {"name": "Computer Science", "degree": "BS", "department": "EECS"},
                {"name": "Artificial Intelligence", "degree": "MS", "department": "CSAIL"}
            ],
            "metadata": {
                "acceptance_rate": 0.04,
                "tuition": 57986,
                "student_count": 11934
            }
        },
        {
            "id": "stanford-001",
            "name": "Stanford University", 
            "location": {"city": "Stanford", "state": "California", "country": "USA"},
            "ranking": {"overall": 2, "engineering": 2, "computerScience": 2},
            "admission_requirements": {
                "minGPA": 3.8,
                "testScores": {"SAT": {"min": 1520, "max": 1600}, "GRE": {"min": 325, "max": 340}}
            },
            "programs": [
                {"name": "Computer Science", "degree": "BS", "department": "Computer Science"},
                {"name": "Machine Learning", "degree": "MS", "department": "Computer Science"}
            ],
            "metadata": {
                "acceptance_rate": 0.05,
                "tuition": 56169,
                "student_count": 17249
            }
        },
        {
            "id": "berkeley-001",
            "name": "UC Berkeley",
            "location": {"city": "Berkeley", "state": "California", "country": "USA"},
            "ranking": {"overall": 3, "engineering": 3, "computerScience": 1},
            "admission_requirements": {
                "minGPA": 3.6,
                "testScores": {"SAT": {"min": 1450, "max": 1600}, "GRE": {"min": 315, "max": 340}}
            },
            "programs": [
                {"name": "Computer Science", "degree": "BS", "department": "EECS"},
                {"name": "Data Science", "degree": "BS", "department": "Statistics"}
            ],
            "metadata": {
                "acceptance_rate": 0.15,
                "tuition": 44066,
                "student_count": 45057
            }
        },
        {
            "id": "cmu-001",
            "name": "Carnegie Mellon University",
            "location": {"city": "Pittsburgh", "state": "Pennsylvania", "country": "USA"},
            "ranking": {"overall": 5, "engineering": 4, "computerScience": 1},
            "admission_requirements": {
                "minGPA": 3.7,
                "testScores": {"SAT": {"min": 1480, "max": 1600}, "GRE": {"min": 320, "max": 340}}
            },
            "programs": [
                {"name": "Computer Science", "degree": "BS", "department": "School of Computer Science"},
                {"name": "Robotics", "degree": "MS", "department": "Robotics Institute"}
            ],
            "metadata": {
                "acceptance_rate": 0.13,
                "tuition": 59864,
                "student_count": 14799
            }
        },
        {
            "id": "gatech-001",
            "name": "Georgia Institute of Technology",
            "location": {"city": "Atlanta", "state": "Georgia", "country": "USA"},
            "ranking": {"overall": 8, "engineering": 4, "computerScience": 6},
            "admission_requirements": {
                "minGPA": 3.5,
                "testScores": {"SAT": {"min": 1400, "max": 1600}, "GRE": {"min": 310, "max": 340}}
            },
            "programs": [
                {"name": "Computer Science", "degree": "BS", "department": "College of Computing"},
                {"name": "Cybersecurity", "degree": "MS", "department": "College of Computing"}
            ],
            "metadata": {
                "acceptance_rate": 0.21,
                "tuition": 33794,
                "student_count": 36848
            }
        }
    ]
    
    # Create and initialize the matcher
    matcher = UniversityMatcher()
    await matcher.initialize(mock_universities)
    
    # Convert student profile to the format expected by the matcher
    student_data = {
        'gpa': request.student_profile.gpa,
        'test_scores': request.student_profile.test_scores,
        'academic_interests': request.student_profile.academic_interests,
        'target_programs': request.student_profile.target_programs,
        'location_preferences': request.student_profile.location_preferences,
        'financial_constraints': request.student_profile.financial_constraints,
        'extracurriculars': request.student_profile.extracurriculars,
        'career_goals': request.student_profile.career_goals
    }
    
    # Apply filters
    filters = {}
    categories = []
    if request.include_safety:
        categories.append('safety')
    if request.include_target:
        categories.append('target')
    if request.include_reach:
        categories.append('reach')
    
    if categories:
        filters['categories'] = categories
    
    if request.filters:
        filters.update(request.filters)
    
    # Get matches from the matcher
    raw_matches = await matcher.find_matches(
        student_data, 
        max_results=request.max_results,
        filters=filters
    )
    
    # Convert to UniversityMatch objects
    matches = []
    for match in raw_matches:
        university_match = UniversityMatch(
            university_id=match['university_id'],
            university_name=match['university_name'],
            match_percentage=match['match_percentage'],
            confidence=match['confidence'],
            category=match['category'],
            reasoning=match['reasoning'],
            factors=match['factors'],
            programs=match['programs'],
            estimated_cost=match['estimated_cost']
        )
        matches.append(university_match)
    
    return matches

def _generate_recommendations(matches: List[UniversityMatch]) -> List[str]:
    """Generate recommendations based on matches"""
    recommendations = []
    
    if not matches:
        return ["Consider expanding your search criteria or improving your academic profile"]
    
    # Analyze match distribution
    categories = {"reach": 0, "target": 0, "safety": 0}
    for match in matches:
        categories[match.category] += 1
    
    total_matches = len(matches)
    
    if categories["safety"] / total_matches < 0.3:
        recommendations.append("Consider adding more safety schools to your list")
    
    if categories["reach"] / total_matches > 0.5:
        recommendations.append("Your list is reach-heavy. Consider adding more target schools")
    
    if categories["target"] == 0:
        recommendations.append("Add some target schools that match your profile well")
    
    # Check for high match scores
    high_matches = [m for m in matches if m.match_percentage >= 90]
    if high_matches:
        recommendations.append(f"You have {len(high_matches)} excellent matches - focus on these applications")
    
    return recommendations

async def _cache_matching_result(cache_key: str, result: str, ttl: int):
    """Cache the matching result"""
    try:
        redis = await get_redis()
        await redis.setex(cache_key, ttl, result)
    except Exception as e:
        logger.warning(f"Failed to cache matching result: {e}")

@router.get("/universities/{student_id}/cached")
async def get_cached_matches(
    student_id: str,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get cached university matches for a student"""
    
    try:
        redis = await get_redis()
        
        # Find all cached matches for this student
        pattern = f"matches:{student_id}:*"
        keys = await redis.keys(pattern)
        
        cached_matches = []
        for key in keys:
            cached_data = await redis.get(key)
            if cached_data:
                cached_matches.append({
                    "cache_key": key,
                    "data": cached_data,
                    "ttl": await redis.ttl(key)
                })
        
        return {
            "student_id": student_id,
            "cached_results": len(cached_matches),
            "matches": cached_matches
        }
        
    except Exception as e:
        logger.error(f"Failed to get cached matches: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cached matches")

@router.delete("/universities/{student_id}/cache")
async def clear_cached_matches(
    student_id: str,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Clear cached university matches for a student"""
    
    try:
        redis = await get_redis()
        
        # Find and delete all cached matches for this student
        pattern = f"matches:{student_id}:*"
        keys = await redis.keys(pattern)
        
        deleted_count = 0
        if keys:
            deleted_count = await redis.delete(*keys)
        
        return {
            "student_id": student_id,
            "deleted_cache_entries": deleted_count,
            "message": "Cache cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to clear cached matches: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")

@router.get("/universities/{university_id}/similar")
async def get_similar_universities(
    university_id: str,
    limit: int = 5,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get universities similar to a given university"""
    
    try:
        from ..services.university_matcher import UniversityMatcher
        
        # Get model manager and matcher
        from ..main import app
        model_manager: ModelManager = app.state.model_manager
        matching_model = await model_manager.get_model("university_matcher")
        
        if not matching_model:
            raise HTTPException(status_code=503, detail="University matching model not available")
        
        # Initialize matcher (would be cached in production)
        matcher = UniversityMatcher()
        
        # Mock university data (same as in matching)
        mock_universities = [
            {
                "id": "mit-001",
                "name": "Massachusetts Institute of Technology",
                "location": {"city": "Cambridge", "state": "Massachusetts", "country": "USA"},
                "programs": [{"name": "Computer Science", "degree": "BS", "department": "EECS"}],
                "metadata": {"acceptance_rate": 0.04, "tuition": 57986}
            },
            {
                "id": "stanford-001",
                "name": "Stanford University",
                "location": {"city": "Stanford", "state": "California", "country": "USA"},
                "programs": [{"name": "Computer Science", "degree": "BS", "department": "Computer Science"}],
                "metadata": {"acceptance_rate": 0.05, "tuition": 56169}
            },
            {
                "id": "berkeley-001",
                "name": "UC Berkeley",
                "location": {"city": "Berkeley", "state": "California", "country": "USA"},
                "programs": [{"name": "Computer Science", "degree": "BS", "department": "EECS"}],
                "metadata": {"acceptance_rate": 0.15, "tuition": 44066}
            }
        ]
        
        await matcher.initialize(mock_universities)
        
        # Get similar universities
        similar_universities = await matcher.get_similar_universities(university_id, limit)
        
        return {
            "university_id": university_id,
            "similar_universities": similar_universities,
            "total_found": len(similar_universities)
        }
        
    except Exception as e:
        logger.error(f"Failed to get similar universities: {e}")
        raise HTTPException(status_code=500, detail="Failed to get similar universities")