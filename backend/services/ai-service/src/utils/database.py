import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import structlog

from ..config import settings

logger = structlog.get_logger()

# Database engine
engine = None
SessionLocal = None
Base = declarative_base()

async def get_database():
    """Get database connection"""
    global engine, SessionLocal
    
    if engine is None:
        # Convert PostgreSQL URL to async version
        database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        
        engine = create_async_engine(
            database_url,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            echo=settings.DEBUG
        )
        
        SessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
    
    return engine

async def get_db_session():
    """Get database session"""
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def test_connection():
    """Test database connection"""
    try:
        engine = await get_database()
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False

async def close_database():
    """Close database connections"""
    global engine
    if engine:
        await engine.dispose()
        engine = None