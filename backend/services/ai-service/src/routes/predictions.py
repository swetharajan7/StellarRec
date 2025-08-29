from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import structlog

from ..services.model_manager import ModelManager
from ..middleware.auth import get_current_user
from ..utils.cache import get_redis
from ..config import CACHE_CONFIGS

logger = structlog.get_logger()
router = APIRouter()

class StudentMetrics(BaseModel):
    """Student metrics for predictions"""
    student_id: str
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    test_scores: Dict[str, Any] = Field(default_factory=dict)
    extracurriculars: List[str] = Field(default_factory=list)
    leadership_roles: List[str] = Field(default_factory=list)
    work_experience: List[str] = Field(default_factory=list)
    research_experience: bool = False
    publications: int = Field(default=0, ge=0)
    awards: List[str] = Field(default_factory=list)
    volunteer_hours: int = Field(default=0, ge=0)
    essay_quality_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    recommendation_strength: Optional[float] = Field(None, ge=0.0, le=100.0)

class UniversityProfile(BaseModel):
    """University profile for predictions"""
    university_id: str
    acceptance_rate: float = Field(..., ge=0.0, le=1.0)
    avg_gpa: float = Field(..., ge=0.0, le=4.0)
    avg_test_scores: Dict[str, float] = Field(default_factory=dict)
    ranking: int = Field(..., ge=1)
    selectivity: str  # highly_selective, selective, moderately_selective
    program_competitiveness: float = Field(default=0.5, ge=0.0, le=1.0)

class AdmissionPredictionRequest(BaseModel):
    """Request for admission probability prediction"""
    student_metrics: StudentMetrics
    university_profile: UniversityProfile
    program_type: Optional[str] = None
    application_strength_factors: Dict[str, float] = Field(default_factory=dict)

class AdmissionPrediction(BaseModel):
    """Admission probability prediction result"""
    university_id: str
    university_name: str
    admission_probability: float = Field(..., ge=0.0, le=1.0)
    confidence_interval: Dict[str, float]  # lower, upper bounds
    risk_category: str  # safety, target, reach
    key_factors: List[Dict[str, Any]]
    improvement_suggestions: List[str]
    comparison_to_admitted_students: Dict[str, Any]

class SuccessPredictionRequest(BaseModel):
    """Request for academic success prediction"""
    student_metrics: StudentMetrics
    university_profile: UniversityProfile
    program_requirements: Dict[str, Any] = Field(default_factory=dict)
    support_systems: List[str] = Field(default_factory=list)

class SuccessPrediction(BaseModel):
    """Academic success prediction result"""
    success_probability: float = Field(..., ge=0.0, le=1.0)
    predicted_gpa_range: Dict[str, float]  # min, max
    graduation_probability: float = Field(..., ge=0.0, le=1.0)
    time_to_graduation: float  # years
    risk_factors: List[str]
    success_factors: List[str]
    recommendations: List[str]

class BenchmarkRequest(BaseModel):
    """Request for peer benchmarking"""
    student_metrics: StudentMetrics
    comparison_criteria: List[str] = Field(default_factory=list)
    anonymize: bool = True

class BenchmarkResult(BaseModel):
    """Peer benchmarking result"""
    percentile_ranking: Dict[str, float]
    peer_comparison: Dict[str, Any]
    strengths: List[str]
    improvement_areas: List[str]
    similar_profiles: List[Dict[str, Any]]

@router.post("/admission-probability", response_model=AdmissionPrediction)
async def predict_admission_probability(
    request: AdmissionPredictionRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
) -> AdmissionPrediction:
    """Predict admission probability for a student at a specific university"""
    
    try:
        # Generate cache key
        cache_key = f"prediction:{request.student_metrics.student_id}:{request.university_profile.university_id}"
        
        # Check cache first
        redis = await get_redis()
        cached_result = await redis.get(cache_key)
        
        if cached_result:
            logger.info(f"Returning cached admission prediction")
            import json
            result_data = json.loads(cached_result)
            return AdmissionPrediction(**result_data)
        
        # Get prediction model
        from ..main import app
        model_manager: ModelManager = app.state.model_manager
        prediction_model = await model_manager.get_model("admission_predictor")
        
        if not prediction_model:
            raise HTTPException(status_code=503, detail="Admission prediction model not available")
        
        # Perform prediction
        prediction_result = await _predict_admission_probability(prediction_model, request)
        
        # Cache result
        background_tasks.add_task(
            _cache_prediction_result,
            cache_key,
            prediction_result.dict(),
            CACHE_CONFIGS["predictions"]["ttl"]
        )
        
        logger.info(
            f"Generated admission prediction for student {request.student_metrics.student_id}",
            university_id=request.university_profile.university_id,
            probability=prediction_result.admission_probability
        )
        
        return prediction_result
        
    except Exception as e:
        logger.error(f"Admission prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

async def _predict_admission_probability(
    model: Dict[str, Any],
    request: AdmissionPredictionRequest
) -> AdmissionPrediction:
    """Perform admission probability prediction"""
    
    student = request.student_metrics
    university = request.university_profile
    
    # Calculate base probability based on academic metrics
    gpa_factor = (student.gpa or 3.0) / university.avg_gpa if university.avg_gpa > 0 else 1.0
    
    # Test score factor (simplified)
    test_score_factor = 1.0
    if student.test_scores and university.avg_test_scores:
        sat_score = student.test_scores.get('SAT', {}).get('total', 1200)
        avg_sat = university.avg_test_scores.get('SAT', 1200)
        test_score_factor = sat_score / avg_sat if avg_sat > 0 else 1.0
    
    # Extracurricular factor
    ec_factor = min(1.5, 1.0 + (len(student.extracurriculars) * 0.1))
    
    # Leadership factor
    leadership_factor = min(1.3, 1.0 + (len(student.leadership_roles) * 0.15))
    
    # Research/awards factor
    research_factor = 1.2 if student.research_experience else 1.0
    awards_factor = min(1.4, 1.0 + (len(student.awards) * 0.1))
    
    # Calculate raw probability
    base_probability = university.acceptance_rate
    adjusted_probability = base_probability * gpa_factor * test_score_factor * ec_factor * leadership_factor * research_factor * awards_factor
    
    # Cap at reasonable bounds
    final_probability = min(0.95, max(0.01, adjusted_probability))
    
    # Determine risk category
    if final_probability >= 0.7:
        risk_category = "safety"
    elif final_probability >= 0.3:
        risk_category = "target"
    else:
        risk_category = "reach"
    
    # Generate key factors
    key_factors = [
        {"factor": "GPA", "impact": gpa_factor, "description": f"Your GPA of {student.gpa or 3.0} vs average {university.avg_gpa}"},
        {"factor": "Test Scores", "impact": test_score_factor, "description": "Standardized test performance"},
        {"factor": "Extracurriculars", "impact": ec_factor, "description": f"{len(student.extracurriculars)} activities"},
        {"factor": "Leadership", "impact": leadership_factor, "description": f"{len(student.leadership_roles)} leadership roles"},
        {"factor": "Research", "impact": research_factor, "description": "Research experience" if student.research_experience else "No research experience"},
        {"factor": "Awards", "impact": awards_factor, "description": f"{len(student.awards)} awards/honors"}
    ]
    
    # Generate improvement suggestions
    suggestions = []
    if gpa_factor < 1.0:
        suggestions.append("Focus on improving your GPA in remaining coursework")
    if test_score_factor < 1.0:
        suggestions.append("Consider retaking standardized tests to improve scores")
    if len(student.extracurriculars) < 3:
        suggestions.append("Engage in more meaningful extracurricular activities")
    if len(student.leadership_roles) == 0:
        suggestions.append("Seek leadership opportunities in your activities")
    if not student.research_experience:
        suggestions.append("Consider participating in research projects")
    
    return AdmissionPrediction(
        university_id=university.university_id,
        university_name=f"University {university.university_id}",  # Would fetch real name
        admission_probability=round(final_probability, 3),
        confidence_interval={
            "lower": max(0.0, final_probability - 0.1),
            "upper": min(1.0, final_probability + 0.1)
        },
        risk_category=risk_category,
        key_factors=key_factors,
        improvement_suggestions=suggestions,
        comparison_to_admitted_students={
            "gpa_percentile": min(100, (student.gpa or 3.0) / university.avg_gpa * 50),
            "test_score_percentile": 60,  # Mock value
            "overall_strength": "above_average" if final_probability > university.acceptance_rate else "average"
        }
    )

@router.post("/academic-success", response_model=SuccessPrediction)
async def predict_academic_success(
    request: SuccessPredictionRequest,
    current_user: Dict = Depends(get_current_user)
) -> SuccessPrediction:
    """Predict academic success probability"""
    
    try:
        # Mock implementation for academic success prediction
        student = request.student_metrics
        
        # Base success probability on GPA and preparation
        base_success = min(0.95, (student.gpa or 3.0) / 4.0 + 0.2)
        
        # Adjust for support systems
        support_factor = 1.0 + (len(request.support_systems) * 0.05)
        final_success = min(0.98, base_success * support_factor)
        
        # Predict GPA range
        predicted_gpa_min = max(2.0, (student.gpa or 3.0) - 0.3)
        predicted_gpa_max = min(4.0, (student.gpa or 3.0) + 0.2)
        
        # Risk and success factors
        risk_factors = []
        success_factors = []
        
        if (student.gpa or 3.0) < 3.5:
            risk_factors.append("Lower incoming GPA may indicate academic challenges")
        else:
            success_factors.append("Strong academic preparation")
        
        if student.research_experience:
            success_factors.append("Research experience indicates strong analytical skills")
        
        if len(student.extracurriculars) > 5:
            risk_factors.append("Heavy extracurricular load may impact study time")
        elif len(student.extracurriculars) > 2:
            success_factors.append("Balanced extracurricular involvement")
        
        recommendations = [
            "Establish strong study habits early in your first semester",
            "Take advantage of academic support services",
            "Build relationships with professors and advisors",
            "Join study groups and academic communities"
        ]
        
        return SuccessPrediction(
            success_probability=round(final_success, 3),
            predicted_gpa_range={"min": predicted_gpa_min, "max": predicted_gpa_max},
            graduation_probability=min(0.98, final_success + 0.1),
            time_to_graduation=4.2,  # Mock value
            risk_factors=risk_factors,
            success_factors=success_factors,
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"Academic success prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.post("/benchmark", response_model=BenchmarkResult)
async def benchmark_student(
    request: BenchmarkRequest,
    current_user: Dict = Depends(get_current_user)
) -> BenchmarkResult:
    """Benchmark student against peers"""
    
    try:
        student = request.student_metrics
        
        # Mock benchmarking - would use actual peer data in production
        percentile_ranking = {
            "gpa": min(100, (student.gpa or 3.0) / 4.0 * 100),
            "extracurriculars": min(100, len(student.extracurriculars) * 20),
            "leadership": min(100, len(student.leadership_roles) * 30),
            "awards": min(100, len(student.awards) * 25),
            "volunteer_hours": min(100, (student.volunteer_hours / 100) * 50)
        }
        
        # Identify strengths and improvement areas
        strengths = []
        improvement_areas = []
        
        for metric, percentile in percentile_ranking.items():
            if percentile >= 75:
                strengths.append(f"Strong {metric.replace('_', ' ')} (top 25%)")
            elif percentile <= 25:
                improvement_areas.append(f"Consider improving {metric.replace('_', ' ')} (bottom 25%)")
        
        return BenchmarkResult(
            percentile_ranking=percentile_ranking,
            peer_comparison={
                "total_peers": 10000,  # Mock value
                "similar_profiles": 250,
                "average_acceptance_rate": 0.45
            },
            strengths=strengths,
            improvement_areas=improvement_areas,
            similar_profiles=[
                {
                    "profile_id": "anonymous_001",
                    "similarity_score": 0.85,
                    "outcomes": {"accepted": 8, "total_applications": 12}
                },
                {
                    "profile_id": "anonymous_002", 
                    "similarity_score": 0.82,
                    "outcomes": {"accepted": 6, "total_applications": 10}
                }
            ]
        )
        
    except Exception as e:
        logger.error(f"Benchmarking failed: {e}")
        raise HTTPException(status_code=500, detail=f"Benchmarking failed: {str(e)}")

async def _cache_prediction_result(cache_key: str, result: dict, ttl: int):
    """Cache the prediction result"""
    try:
        redis = await get_redis()
        import json
        await redis.setex(cache_key, ttl, json.dumps(result))
    except Exception as e:
        logger.warning(f"Failed to cache prediction result: {e}")

@router.get("/models/status")
async def get_prediction_models_status(
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of prediction models"""
    
    try:
        from ..main import app
        model_manager: ModelManager = app.state.model_manager
        
        models_status = {}
        
        # Check admission predictor
        admission_model = await model_manager.get_model("admission_predictor")
        models_status["admission_predictor"] = {
            "loaded": admission_model is not None,
            "type": "gradient_boosting",
            "features": admission_model.get("features", []) if admission_model else [],
            "last_updated": "2024-01-01T00:00:00Z"  # Mock timestamp
        }
        
        return {
            "models": models_status,
            "total_models": len(models_status),
            "all_loaded": all(m["loaded"] for m in models_status.values())
        }
        
    except Exception as e:
        logger.error(f"Failed to get models status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get models status")