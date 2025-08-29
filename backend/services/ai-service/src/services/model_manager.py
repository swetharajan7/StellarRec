import asyncio
import os
import pickle
import hashlib
import psutil
from typing import Dict, Any, Optional, List
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel, pipeline
import torch
import structlog
from datetime import datetime, timedelta

from ..config import settings, MODEL_CONFIGS
from ..utils.cache import get_redis

logger = structlog.get_logger()

class ModelManager:
    """Manages ML models loading, caching, and inference"""
    
    def __init__(self):
        self.loaded_models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict] = {}
        self.redis = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
    async def initialize(self):
        """Initialize the model manager"""
        logger.info("Initializing Model Manager")
        
        # Get Redis connection
        self.redis = await get_redis()
        
        # Create model cache directory
        os.makedirs(settings.MODEL_CACHE_DIR, exist_ok=True)
        
        # Load essential models
        await self._load_essential_models()
        
        logger.info(f"Model Manager initialized with {len(self.loaded_models)} models")
    
    async def _load_essential_models(self):
        """Load essential models for the service"""
        try:
            # Load university matching model
            await self.load_model("university_matcher", MODEL_CONFIGS["university_matcher"])
            
            # Load essay analysis model
            if settings.ENABLE_ESSAY_ANALYSIS:
                await self.load_model("essay_analyzer", MODEL_CONFIGS["essay_analyzer"])
            
            # Load prediction models
            if settings.ENABLE_PREDICTIONS:
                await self.load_model("admission_predictor", MODEL_CONFIGS["admission_predictor"])
                
        except Exception as e:
            logger.error(f"Failed to load essential models: {e}")
            raise
    
    async def load_model(self, model_name: str, config: Dict[str, Any]) -> bool:
        """Load a specific model"""
        try:
            logger.info(f"Loading model: {model_name}")
            
            if model_name in self.loaded_models:
                logger.info(f"Model {model_name} already loaded")
                return True
            
            # Check memory usage
            if not self._check_memory_availability():
                logger.warning("Insufficient memory to load model")
                return False
            
            model = None
            
            if config["type"] == "transformer":
                model = await self._load_transformer_model(config)
            elif config["type"] == "collaborative_filtering":
                model = await self._load_collaborative_filtering_model(config)
            elif config["type"] == "gradient_boosting":
                model = await self._load_gradient_boosting_model(config)
            else:
                logger.error(f"Unknown model type: {config['type']}")
                return False
            
            if model:
                self.loaded_models[model_name] = model
                self.model_metadata[model_name] = {
                    "config": config,
                    "loaded_at": datetime.utcnow(),
                    "last_used": datetime.utcnow(),
                    "usage_count": 0
                }
                logger.info(f"Successfully loaded model: {model_name}")
                return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False
        
        return False
    
    async def _load_transformer_model(self, config: Dict[str, Any]) -> Optional[Any]:
        """Load transformer-based model"""
        model_name = config.get("model_name", "bert-base-uncased")
        
        try:
            # Load tokenizer and model
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name)
            
            # Create analysis pipeline
            analyzer = pipeline(
                "text-classification",
                model=model,
                tokenizer=tokenizer,
                device=0 if torch.cuda.is_available() else -1
            )
            
            return {
                "tokenizer": tokenizer,
                "model": model,
                "analyzer": analyzer,
                "type": "transformer"
            }
            
        except Exception as e:
            logger.error(f"Failed to load transformer model: {e}")
            return None
    
    async def _load_collaborative_filtering_model(self, config: Dict[str, Any]) -> Optional[Any]:
        """Load collaborative filtering model for university matching"""
        try:
            # Create a simple collaborative filtering model
            # In production, this would load a pre-trained model
            
            model = {
                "type": "collaborative_filtering",
                "features": config["features"],
                "weights": config["weights"],
                "vectorizer": TfidfVectorizer(max_features=1000),
                "similarity_matrix": None  # Will be computed on first use
            }
            
            return model
            
        except Exception as e:
            logger.error(f"Failed to load collaborative filtering model: {e}")
            return None
    
    async def _load_gradient_boosting_model(self, config: Dict[str, Any]) -> Optional[Any]:
        """Load gradient boosting model for predictions"""
        try:
            # Create a gradient boosting classifier
            # In production, this would load a pre-trained model
            
            model = GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=3,
                random_state=42
            )
            
            return {
                "model": model,
                "features": config["features"],
                "target": config["target"],
                "type": "gradient_boosting",
                "is_trained": False  # Would be True for pre-trained models
            }
            
        except Exception as e:
            logger.error(f"Failed to load gradient boosting model: {e}")
            return None
    
    async def get_model(self, model_name: str) -> Optional[Any]:
        """Get a loaded model"""
        if model_name not in self.loaded_models:
            logger.warning(f"Model {model_name} not loaded")
            return None
        
        # Update usage statistics
        self.model_metadata[model_name]["last_used"] = datetime.utcnow()
        self.model_metadata[model_name]["usage_count"] += 1
        
        return self.loaded_models[model_name]
    
    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory"""
        if model_name not in self.loaded_models:
            return False
        
        try:
            del self.loaded_models[model_name]
            del self.model_metadata[model_name]
            
            # Force garbage collection
            import gc
            gc.collect()
            
            logger.info(f"Unloaded model: {model_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to unload model {model_name}: {e}")
            return False
    
    def _check_memory_availability(self) -> bool:
        """Check if there's enough memory to load a new model"""
        memory = psutil.virtual_memory()
        available_mb = memory.available / (1024 * 1024)
        
        return available_mb > settings.MAX_MODEL_MEMORY_MB
    
    def get_memory_usage(self) -> Dict[str, float]:
        """Get current memory usage statistics"""
        memory = psutil.virtual_memory()
        
        return {
            "total_mb": memory.total / (1024 * 1024),
            "available_mb": memory.available / (1024 * 1024),
            "used_mb": memory.used / (1024 * 1024),
            "percent": memory.percent
        }
    
    async def cleanup_unused_models(self, max_idle_hours: int = 2):
        """Clean up models that haven't been used recently"""
        current_time = datetime.utcnow()
        models_to_unload = []
        
        for model_name, metadata in self.model_metadata.items():
            idle_time = current_time - metadata["last_used"]
            if idle_time > timedelta(hours=max_idle_hours):
                models_to_unload.append(model_name)
        
        for model_name in models_to_unload:
            await self.unload_model(model_name)
            logger.info(f"Cleaned up unused model: {model_name}")
    
    async def get_model_status(self) -> Dict[str, Any]:
        """Get status of all loaded models"""
        status = {}
        
        for model_name, metadata in self.model_metadata.items():
            status[model_name] = {
                "loaded": True,
                "type": metadata["config"]["type"],
                "loaded_at": metadata["loaded_at"].isoformat(),
                "last_used": metadata["last_used"].isoformat(),
                "usage_count": metadata["usage_count"]
            }
        
        return status
    
    async def reload_model(self, model_name: str) -> bool:
        """Reload a specific model"""
        if model_name not in self.model_metadata:
            logger.error(f"Model {model_name} not found")
            return False
        
        config = self.model_metadata[model_name]["config"]
        
        # Unload current model
        await self.unload_model(model_name)
        
        # Load fresh model
        return await self.load_model(model_name, config)
    
    async def cache_model_result(self, cache_key: str, result: Any, ttl: int = 3600):
        """Cache model inference result"""
        if self.redis:
            try:
                serialized_result = pickle.dumps(result)
                await self.redis.setex(cache_key, ttl, serialized_result)
            except Exception as e:
                logger.warning(f"Failed to cache result: {e}")
    
    async def get_cached_result(self, cache_key: str) -> Optional[Any]:
        """Get cached model inference result"""
        if self.redis:
            try:
                cached_data = await self.redis.get(cache_key)
                if cached_data:
                    return pickle.loads(cached_data)
            except Exception as e:
                logger.warning(f"Failed to get cached result: {e}")
        
        return None
    
    def generate_cache_key(self, model_name: str, input_data: Any) -> str:
        """Generate cache key for model inference"""
        # Create hash of input data
        input_str = str(input_data)
        input_hash = hashlib.md5(input_str.encode()).hexdigest()
        
        return f"model:{model_name}:{input_hash}"
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up Model Manager")
        
        # Unload all models
        for model_name in list(self.loaded_models.keys()):
            await self.unload_model(model_name)
        
        # Close Redis connection
        if self.redis:
            await self.redis.close()
        
        logger.info("Model Manager cleanup completed")