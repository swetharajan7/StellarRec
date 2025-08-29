from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import structlog
import os
from prometheus_client import make_asgi_app, Counter, Histogram, Gauge
import time

from .config import settings
from .middleware.logging import LoggingMiddleware
from .middleware.auth import AuthMiddleware
from .middleware.error_handler import ErrorHandlerMiddleware
from .routes import health, matching, essay_analysis, predictions
from .services.model_manager import ModelManager
from .utils.database import get_database
from .utils.cache import get_redis

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('ai_service_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('ai_service_request_duration_seconds', 'Request duration')
ACTIVE_MODELS = Gauge('ai_service_active_models', 'Number of active ML models')
MODEL_INFERENCE_TIME = Histogram('ai_service_model_inference_seconds', 'Model inference time', ['model_type'])

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting AI/ML Service")
    
    # Initialize model manager
    model_manager = ModelManager()
    await model_manager.initialize()
    app.state.model_manager = model_manager
    
    # Initialize database connection
    database = await get_database()
    app.state.database = database
    
    # Initialize Redis connection
    redis = await get_redis()
    app.state.redis = redis
    
    ACTIVE_MODELS.set(len(model_manager.loaded_models))
    logger.info("AI/ML Service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI/ML Service")
    await model_manager.cleanup()
    await database.disconnect()
    await redis.close()

# Create FastAPI app
app = FastAPI(
    title="StellarRec AI/ML Service",
    description="AI-powered university matching and essay analysis service",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

app.add_middleware(LoggingMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(ErrorHandlerMiddleware)

# Add Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(matching.router, prefix="/api/v1/matching", tags=["University Matching"])
app.include_router(essay_analysis.router, prefix="/api/v1/essay", tags=["Essay Analysis"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["Predictions"])

@app.middleware("http")
async def metrics_middleware(request, call_next):
    """Middleware to collect Prometheus metrics"""
    start_time = time.time()
    
    response = await call_next(request)
    
    # Record metrics
    duration = time.time() - start_time
    REQUEST_DURATION.observe(duration)
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "StellarRec AI/ML Service",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "metrics": "/metrics",
            "university_matching": "/api/v1/matching",
            "essay_analysis": "/api/v1/essay",
            "predictions": "/api/v1/predictions"
        }
    }

@app.get("/status")
async def status():
    """Service status endpoint"""
    model_manager = app.state.model_manager
    
    return {
        "service": "ai-service",
        "status": "healthy",
        "models": {
            "loaded": len(model_manager.loaded_models),
            "available": list(model_manager.loaded_models.keys())
        },
        "memory_usage": model_manager.get_memory_usage(),
        "uptime": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8002,
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    )