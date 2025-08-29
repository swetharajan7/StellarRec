from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import hashlib
from datetime import datetime
import structlog

from ..services.model_manager import ModelManager
from ..middleware.auth import get_current_user
from ..utils.cache import get_redis
from ..config import CACHE_CONFIGS, settings

logger = structlog.get_logger()
router = APIRouter()

class EssayAnalysisRequest(BaseModel):
    """Request for essay analysis"""
    content: str = Field(..., min_length=settings.ESSAY_MIN_LENGTH, max_length=settings.ESSAY_MAX_LENGTH)
    essay_type: Optional[str] = "personal_statement"
    target_universities: List[str] = Field(default_factory=list)
    prompt: Optional[str] = None
    word_limit: Optional[int] = None

class EssayScore(BaseModel):
    """Essay scoring metrics"""
    clarity: float = Field(..., ge=0.0, le=100.0)
    coherence: float = Field(..., ge=0.0, le=100.0)
    grammar: float = Field(..., ge=0.0, le=100.0)
    vocabulary: float = Field(..., ge=0.0, le=100.0)
    structure: float = Field(..., ge=0.0, le=100.0)
    originality: float = Field(..., ge=0.0, le=100.0)
    relevance: float = Field(..., ge=0.0, le=100.0)
    overall: float = Field(..., ge=0.0, le=100.0)

class EssaySuggestion(BaseModel):
    """Essay improvement suggestion"""
    type: str  # content, grammar, structure, style
    text: str
    position: Optional[Dict[str, int]] = None  # start, end positions
    confidence: float = Field(..., ge=0.0, le=1.0)
    priority: str = "medium"  # low, medium, high

class EssayAnalysisResponse(BaseModel):
    """Response for essay analysis"""
    scores: EssayScore
    suggestions: List[EssaySuggestion]
    word_count: int
    readability_score: float
    sentiment: str
    key_topics: List[str]
    university_alignment: Dict[str, float] = Field(default_factory=dict)
    processing_time_ms: float
    cached: bool = False

@router.post("/analyze", response_model=EssayAnalysisResponse)
async def analyze_essay(
    request: EssayAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
) -> EssayAnalysisResponse:
    """Analyze essay content and provide feedback"""
    
    start_time = datetime.utcnow()
    
    try:
        # Generate cache key based on content hash
        content_hash = hashlib.md5(request.content.encode()).hexdigest()
        cache_key = f"essay:{content_hash}"
        
        # Check cache first
        redis = await get_redis()
        cached_result = await redis.get(cache_key)
        
        if cached_result:
            logger.info(f"Returning cached essay analysis for content hash {content_hash}")
            import json
            result_data = json.loads(cached_result)
            result = EssayAnalysisResponse(**result_data)
            result.cached = True
            return result
        
        # Get essay analysis model
        from ..main import app
        model_manager: ModelManager = app.state.model_manager
        essay_model = await model_manager.get_model("essay_analyzer")
        
        if not essay_model:
            raise HTTPException(status_code=503, detail="Essay analysis model not available")
        
        # Perform analysis
        analysis_result = await _perform_essay_analysis(essay_model, request)
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        analysis_result.processing_time_ms = processing_time
        
        # Cache result
        background_tasks.add_task(
            _cache_analysis_result,
            cache_key,
            analysis_result.dict(),
            CACHE_CONFIGS["essay_analysis"]["ttl"]
        )
        
        # Log analysis event
        logger.info(
            f"Completed essay analysis for user {current_user['user_id']}",
            word_count=analysis_result.word_count,
            overall_score=analysis_result.scores.overall,
            processing_time_ms=processing_time
        )
        
        return analysis_result
        
    except Exception as e:
        logger.error(f"Essay analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def _perform_essay_analysis(
    model: Dict[str, Any], 
    request: EssayAnalysisRequest
) -> EssayAnalysisResponse:
    """Perform the actual essay analysis"""
    
    content = request.content
    word_count = len(content.split())
    
    # Mock analysis - in production this would use the actual ML model
    
    # Calculate basic scores
    scores = EssayScore(
        clarity=_calculate_clarity_score(content),
        coherence=_calculate_coherence_score(content),
        grammar=_calculate_grammar_score(content),
        vocabulary=_calculate_vocabulary_score(content),
        structure=_calculate_structure_score(content),
        originality=_calculate_originality_score(content),
        relevance=_calculate_relevance_score(content, request.prompt),
        overall=0.0  # Will be calculated
    )
    
    # Calculate overall score
    scores.overall = (
        scores.clarity * 0.2 +
        scores.coherence * 0.15 +
        scores.grammar * 0.15 +
        scores.vocabulary * 0.1 +
        scores.structure * 0.15 +
        scores.originality * 0.15 +
        scores.relevance * 0.1
    )
    
    # Generate suggestions
    suggestions = _generate_suggestions(content, scores)
    
    # Calculate readability
    readability_score = _calculate_readability(content)
    
    # Analyze sentiment
    sentiment = _analyze_sentiment(content)
    
    # Extract key topics
    key_topics = _extract_key_topics(content)
    
    # Calculate university alignment if target universities provided
    university_alignment = {}
    if request.target_universities:
        for uni in request.target_universities:
            university_alignment[uni] = _calculate_university_alignment(content, uni)
    
    return EssayAnalysisResponse(
        scores=scores,
        suggestions=suggestions,
        word_count=word_count,
        readability_score=readability_score,
        sentiment=sentiment,
        key_topics=key_topics,
        university_alignment=university_alignment,
        processing_time_ms=0.0  # Will be set by caller
    )

def _calculate_clarity_score(content: str) -> float:
    """Calculate clarity score based on sentence structure and word choice"""
    # Mock implementation
    sentences = content.split('.')
    avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
    
    # Penalize very long or very short sentences
    if 15 <= avg_sentence_length <= 25:
        return 85.0
    elif 10 <= avg_sentence_length <= 30:
        return 75.0
    else:
        return 65.0

def _calculate_coherence_score(content: str) -> float:
    """Calculate coherence score based on logical flow"""
    # Mock implementation - would use NLP models in production
    paragraphs = content.split('\n\n')
    if len(paragraphs) >= 3:
        return 80.0
    elif len(paragraphs) >= 2:
        return 70.0
    else:
        return 60.0

def _calculate_grammar_score(content: str) -> float:
    """Calculate grammar score"""
    # Mock implementation - would use grammar checking models
    # Check for basic issues
    issues = 0
    
    # Check for common grammar mistakes (simplified)
    if ' i ' in content.lower():  # Uncapitalized 'I'
        issues += 1
    if content.count('.') < len(content.split()) / 20:  # Too few periods
        issues += 1
    
    base_score = 90.0
    return max(60.0, base_score - (issues * 10))

def _calculate_vocabulary_score(content: str) -> float:
    """Calculate vocabulary sophistication score"""
    words = content.lower().split()
    unique_words = set(words)
    
    # Calculate lexical diversity
    lexical_diversity = len(unique_words) / len(words) if words else 0
    
    # Mock scoring based on diversity
    if lexical_diversity > 0.7:
        return 90.0
    elif lexical_diversity > 0.5:
        return 80.0
    elif lexical_diversity > 0.3:
        return 70.0
    else:
        return 60.0

def _calculate_structure_score(content: str) -> float:
    """Calculate essay structure score"""
    paragraphs = content.split('\n\n')
    
    # Check for introduction, body, conclusion structure
    if len(paragraphs) >= 4:  # Intro + 2+ body + conclusion
        return 85.0
    elif len(paragraphs) >= 3:  # Intro + body + conclusion
        return 75.0
    else:
        return 65.0

def _calculate_originality_score(content: str) -> float:
    """Calculate originality score"""
    # Mock implementation - would check against database of essays
    # For now, return a random-ish score based on content length and complexity
    words = content.split()
    unique_words = set(words)
    
    complexity = len(unique_words) / len(words) if words else 0
    return min(95.0, 60.0 + (complexity * 40))

def _calculate_relevance_score(content: str, prompt: Optional[str]) -> float:
    """Calculate relevance to prompt score"""
    if not prompt:
        return 75.0  # Default score when no prompt provided
    
    # Mock implementation - would use semantic similarity in production
    prompt_words = set(prompt.lower().split())
    content_words = set(content.lower().split())
    
    overlap = len(prompt_words.intersection(content_words))
    relevance = overlap / len(prompt_words) if prompt_words else 0
    
    return min(95.0, 50.0 + (relevance * 45))

def _generate_suggestions(content: str, scores: EssayScore) -> List[EssaySuggestion]:
    """Generate improvement suggestions based on analysis"""
    suggestions = []
    
    # Grammar suggestions
    if scores.grammar < 80:
        suggestions.append(EssaySuggestion(
            type="grammar",
            text="Consider reviewing your essay for grammar and punctuation errors. Use tools like Grammarly for additional help.",
            confidence=0.8,
            priority="high"
        ))
    
    # Structure suggestions
    if scores.structure < 75:
        suggestions.append(EssaySuggestion(
            type="structure",
            text="Your essay would benefit from clearer paragraph structure. Consider adding topic sentences and transitions.",
            confidence=0.85,
            priority="high"
        ))
    
    # Clarity suggestions
    if scores.clarity < 75:
        suggestions.append(EssaySuggestion(
            type="content",
            text="Some sentences could be clearer. Try breaking down complex ideas into simpler, more direct statements.",
            confidence=0.75,
            priority="medium"
        ))
    
    # Vocabulary suggestions
    if scores.vocabulary < 70:
        suggestions.append(EssaySuggestion(
            type="style",
            text="Consider using more varied vocabulary to make your essay more engaging and sophisticated.",
            confidence=0.7,
            priority="medium"
        ))
    
    # Originality suggestions
    if scores.originality < 70:
        suggestions.append(EssaySuggestion(
            type="content",
            text="Try to include more unique personal experiences or perspectives to make your essay stand out.",
            confidence=0.8,
            priority="high"
        ))
    
    return suggestions

def _calculate_readability(content: str) -> float:
    """Calculate readability score (simplified Flesch Reading Ease)"""
    sentences = content.count('.') + content.count('!') + content.count('?')
    words = len(content.split())
    syllables = sum(_count_syllables(word) for word in content.split())
    
    if sentences == 0 or words == 0:
        return 50.0
    
    # Simplified Flesch Reading Ease formula
    score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words))
    return max(0.0, min(100.0, score))

def _count_syllables(word: str) -> int:
    """Count syllables in a word (simplified)"""
    word = word.lower()
    vowels = 'aeiouy'
    syllable_count = 0
    previous_was_vowel = False
    
    for char in word:
        if char in vowels:
            if not previous_was_vowel:
                syllable_count += 1
            previous_was_vowel = True
        else:
            previous_was_vowel = False
    
    # Handle silent 'e'
    if word.endswith('e') and syllable_count > 1:
        syllable_count -= 1
    
    return max(1, syllable_count)

def _analyze_sentiment(content: str) -> str:
    """Analyze sentiment of the essay"""
    # Mock implementation - would use sentiment analysis model
    positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'passion']
    negative_words = ['bad', 'terrible', 'awful', 'hate', 'difficult', 'struggle']
    
    content_lower = content.lower()
    positive_count = sum(1 for word in positive_words if word in content_lower)
    negative_count = sum(1 for word in negative_words if word in content_lower)
    
    if positive_count > negative_count:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    else:
        return "neutral"

def _extract_key_topics(content: str) -> List[str]:
    """Extract key topics from the essay"""
    # Mock implementation - would use topic modeling in production
    common_topics = [
        'education', 'career', 'leadership', 'community', 'research',
        'technology', 'innovation', 'diversity', 'challenge', 'growth',
        'experience', 'passion', 'goal', 'achievement', 'impact'
    ]
    
    content_lower = content.lower()
    found_topics = [topic for topic in common_topics if topic in content_lower]
    
    return found_topics[:5]  # Return top 5 topics

def _calculate_university_alignment(content: str, university: str) -> float:
    """Calculate how well the essay aligns with a specific university"""
    # Mock implementation - would use university-specific models
    # For now, return a score based on content quality
    word_count = len(content.split())
    
    if word_count > 400:
        return 85.0
    elif word_count > 250:
        return 75.0
    else:
        return 65.0

async def _cache_analysis_result(cache_key: str, result: dict, ttl: int):
    """Cache the analysis result"""
    try:
        redis = await get_redis()
        import json
        await redis.setex(cache_key, ttl, json.dumps(result))
    except Exception as e:
        logger.warning(f"Failed to cache analysis result: {e}")

@router.get("/suggestions/{essay_type}")
async def get_essay_suggestions(
    essay_type: str,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get general writing suggestions for essay type"""
    
    suggestions_map = {
        "personal_statement": [
            "Start with a compelling hook that draws the reader in",
            "Show, don't tell - use specific examples and anecdotes",
            "Connect your experiences to your future goals",
            "Be authentic and let your personality shine through",
            "End with a strong conclusion that ties everything together"
        ],
        "supplemental": [
            "Answer the prompt directly and specifically",
            "Research the school thoroughly and mention specific programs",
            "Explain why you're a good fit for this particular institution",
            "Keep it concise and focused",
            "Avoid repeating information from your personal statement"
        ],
        "scholarship": [
            "Clearly explain your financial need if applicable",
            "Highlight your achievements and potential impact",
            "Connect your goals to the scholarship's mission",
            "Be specific about how the scholarship will help you",
            "Express genuine gratitude and enthusiasm"
        ]
    }
    
    return {
        "essay_type": essay_type,
        "suggestions": suggestions_map.get(essay_type, []),
        "word_limits": {
            "personal_statement": "500-650 words",
            "supplemental": "150-300 words",
            "scholarship": "300-500 words"
        }
    }