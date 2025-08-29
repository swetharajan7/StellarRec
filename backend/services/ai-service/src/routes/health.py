from fastapi import APIRouter, Depends
from typing import Dict, Any
import time
import psutil
from datetime import datetime

from ..services.model_manager import ModelManager
from ..utils.database import get_database
from ..utils.cache import get_redis

router = APIRouter()

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-service",
        "version": "1.0.0"
    }

@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with system metrics"""
    
    # System metrics
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=1)
    disk = psutil.disk_usage('/')
    
    # Check database connectivity
    database_status = "unknown"
    try:
        db = await get_database()
        await db.execute("SELECT 1")
        database_status = "healthy"
    except Exception as e:
        database_status = f"unhealthy: {str(e)}"
    
    # Check Redis connectivity
    redis_status = "unknown"
    try:
        redis = await get_redis()
        await redis.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-service",
        "version": "1.0.0",
        "system": {
            "memory": {
                "total_mb": round(memory.total / (1024 * 1024), 2),
                "available_mb": round(memory.available / (1024 * 1024), 2),
                "used_percent": memory.percent
            },
            "cpu": {
                "usage_percent": cpu_percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
                "free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
                "used_percent": round((disk.used / disk.total) * 100, 2)
            }
        },
        "dependencies": {
            "database": database_status,
            "redis": redis_status
        }
    }

@router.get("/models")
async def models_health() -> Dict[str, Any]:
    """Health check for ML models"""
    from ..main import app
    
    try:
        model_manager: ModelManager = app.state.model_manager
        model_status = await model_manager.get_model_status()
        memory_usage = model_manager.get_memory_usage()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "models": model_status,
            "memory_usage": memory_usage,
            "total_models": len(model_status)
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "models": {},
            "total_models": 0
        }

@router.get("/readiness")
async def readiness_check() -> Dict[str, Any]:
    """Kubernetes readiness probe"""
    from ..main import app
    
    checks = {
        "database": False,
        "redis": False,
        "models": False
    }
    
    # Check database
    try:
        db = await get_database()
        await db.execute("SELECT 1")
        checks["database"] = True
    except:
        pass
    
    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = True
    except:
        pass
    
    # Check models
    try:
        model_manager: ModelManager = app.state.model_manager
        if len(model_manager.loaded_models) > 0:
            checks["models"] = True
    except:
        pass
    
    all_ready = all(checks.values())
    
    return {
        "ready": all_ready,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }

@router.get("/liveness")
async def liveness_check() -> Dict[str, Any]:
    """Kubernetes liveness probe"""
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": time.time() - getattr(liveness_check, 'start_time', time.time())
    }

# Set start time for uptime calculation
liveness_check.start_time = time.time()