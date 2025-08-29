import redis.asyncio as redis
from typing import Optional, Any
import json
import pickle
import structlog

from ..config import settings

logger = structlog.get_logger()

# Global Redis connection
_redis_client: Optional[redis.Redis] = None

async def get_redis() -> redis.Redis:
    """Get Redis connection"""
    global _redis_client
    
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=False  # We'll handle encoding ourselves
        )
    
    return _redis_client

async def close_redis():
    """Close Redis connection"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None

class CacheManager:
    """Redis cache manager with serialization support"""
    
    def __init__(self):
        self.redis = None
    
    async def initialize(self):
        """Initialize cache manager"""
        self.redis = await get_redis()
    
    async def set(self, key: str, value: Any, ttl: int = 3600, serialize: str = "json"):
        """Set a value in cache with optional serialization"""
        if not self.redis:
            await self.initialize()
        
        try:
            if serialize == "json":
                serialized_value = json.dumps(value)
            elif serialize == "pickle":
                serialized_value = pickle.dumps(value)
            else:
                serialized_value = str(value)
            
            await self.redis.setex(key, ttl, serialized_value)
            return True
            
        except Exception as e:
            logger.error(f"Cache set failed for key {key}: {e}")
            return False
    
    async def get(self, key: str, deserialize: str = "json") -> Optional[Any]:
        """Get a value from cache with optional deserialization"""
        if not self.redis:
            await self.initialize()
        
        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            
            if deserialize == "json":
                return json.loads(value)
            elif deserialize == "pickle":
                return pickle.loads(value)
            else:
                return value.decode('utf-8') if isinstance(value, bytes) else value
                
        except Exception as e:
            logger.error(f"Cache get failed for key {key}: {e}")
            return None
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if not self.redis:
            await self.initialize()
        
        try:
            result = await self.redis.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete failed for key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.redis:
            await self.initialize()
        
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache exists check failed for key {key}: {e}")
            return False
    
    async def ttl(self, key: str) -> int:
        """Get TTL for a key"""
        if not self.redis:
            await self.initialize()
        
        try:
            return await self.redis.ttl(key)
        except Exception as e:
            logger.error(f"Cache TTL check failed for key {key}: {e}")
            return -1
    
    async def keys(self, pattern: str) -> list:
        """Get keys matching pattern"""
        if not self.redis:
            await self.initialize()
        
        try:
            keys = await self.redis.keys(pattern)
            return [key.decode('utf-8') if isinstance(key, bytes) else key for key in keys]
        except Exception as e:
            logger.error(f"Cache keys search failed for pattern {pattern}: {e}")
            return []
    
    async def flush_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.redis:
            await self.initialize()
        
        try:
            keys = await self.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache flush pattern failed for {pattern}: {e}")
            return 0
    
    async def increment(self, key: str, amount: int = 1, ttl: Optional[int] = None) -> int:
        """Increment a counter in cache"""
        if not self.redis:
            await self.initialize()
        
        try:
            result = await self.redis.incrby(key, amount)
            if ttl and result == amount:  # First time setting
                await self.redis.expire(key, ttl)
            return result
        except Exception as e:
            logger.error(f"Cache increment failed for key {key}: {e}")
            return 0
    
    async def set_hash(self, key: str, mapping: dict, ttl: int = 3600) -> bool:
        """Set a hash in cache"""
        if not self.redis:
            await self.initialize()
        
        try:
            await self.redis.hset(key, mapping=mapping)
            await self.redis.expire(key, ttl)
            return True
        except Exception as e:
            logger.error(f"Cache hash set failed for key {key}: {e}")
            return False
    
    async def get_hash(self, key: str, field: Optional[str] = None) -> Optional[Any]:
        """Get a hash or hash field from cache"""
        if not self.redis:
            await self.initialize()
        
        try:
            if field:
                value = await self.redis.hget(key, field)
                return value.decode('utf-8') if isinstance(value, bytes) else value
            else:
                hash_data = await self.redis.hgetall(key)
                return {
                    k.decode('utf-8') if isinstance(k, bytes) else k: 
                    v.decode('utf-8') if isinstance(v, bytes) else v 
                    for k, v in hash_data.items()
                }
        except Exception as e:
            logger.error(f"Cache hash get failed for key {key}: {e}")
            return None

# Global cache manager instance
cache = CacheManager()