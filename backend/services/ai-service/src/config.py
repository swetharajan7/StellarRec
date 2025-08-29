from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Service Configuration
    SERVICE_NAME: str = "ai-service"
    SERVICE_VERSION: str = "1.0.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8002
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "ai-service"]
    
    # Database
    DATABASE_URL: str = "postgresql://stellarrec:password@localhost:5432/stellarrec"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600  # 1 hour
    
    # ML Models Configuration
    MODEL_CACHE_DIR: str = "./models"
    MODEL_DOWNLOAD_TIMEOUT: int = 300  # 5 minutes
    MAX_MODEL_MEMORY_MB: int = 2048  # 2GB
    
    # University Matching Model
    MATCHING_MODEL_NAME: str = "university_matcher_v1"
    MATCHING_MODEL_VERSION: str = "1.0.0"
    MATCHING_CONFIDENCE_THRESHOLD: float = 0.7
    
    # Essay Analysis Model
    ESSAY_MODEL_NAME: str = "bert-base-uncased"
    ESSAY_MAX_LENGTH: int = 2000
    ESSAY_MIN_LENGTH: int = 50
    
    # Prediction Models
    ADMISSION_PREDICTION_MODEL: str = "admission_predictor_v1"
    SUCCESS_PREDICTION_MODEL: str = "success_predictor_v1"
    
    # External APIs
    OPENAI_API_KEY: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None
    
    # Celery (for async tasks)
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    LOG_LEVEL: str = "INFO"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_BURST: int = 200
    
    # Feature Flags
    ENABLE_ESSAY_ANALYSIS: bool = True
    ENABLE_UNIVERSITY_MATCHING: bool = True
    ENABLE_PREDICTIONS: bool = True
    ENABLE_REAL_TIME_SUGGESTIONS: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# Model configurations
MODEL_CONFIGS = {
    "university_matcher": {
        "type": "collaborative_filtering",
        "features": [
            "gpa", "test_scores", "academic_interests", "location_preference",
            "program_type", "university_ranking", "admission_requirements"
        ],
        "weights": {
            "academic_fit": 0.4,
            "interest_alignment": 0.35,
            "location_preference": 0.15,
            "financial_fit": 0.1
        }
    },
    "essay_analyzer": {
        "type": "transformer",
        "model_name": "bert-base-uncased",
        "max_length": 512,
        "metrics": [
            "clarity", "coherence", "grammar", "vocabulary",
            "structure", "originality", "relevance"
        ]
    },
    "admission_predictor": {
        "type": "gradient_boosting",
        "features": [
            "gpa", "test_scores", "extracurriculars", "essays_quality",
            "recommendations_strength", "university_selectivity"
        ],
        "target": "admission_probability"
    }
}

# Cache configurations
CACHE_CONFIGS = {
    "university_matches": {
        "ttl": 3600,  # 1 hour
        "key_pattern": "matches:{student_id}"
    },
    "essay_analysis": {
        "ttl": 1800,  # 30 minutes
        "key_pattern": "essay:{content_hash}"
    },
    "predictions": {
        "ttl": 7200,  # 2 hours
        "key_pattern": "prediction:{student_id}:{university_id}"
    }
}