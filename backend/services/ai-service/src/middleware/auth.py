from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Dict, Optional
import structlog

from ..config import settings

logger = structlog.get_logger()
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Get current user from JWT token"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        # Get additional user info from token
        user_data = {
            "user_id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role"),
            "permissions": payload.get("permissions", [])
        }
        
        return user_data
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise credentials_exception

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict]:
    """Get current user from JWT token (optional)"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

def require_role(required_role: str):
    """Decorator to require specific user role"""
    def role_checker(current_user: Dict = Depends(get_current_user)) -> Dict:
        if current_user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    return role_checker

def require_permission(required_permission: str):
    """Decorator to require specific permission"""
    def permission_checker(current_user: Dict = Depends(get_current_user)) -> Dict:
        permissions = current_user.get("permissions", [])
        if required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{required_permission}' required"
            )
        return current_user
    return permission_checker

class AuthMiddleware:
    """Authentication middleware for FastAPI"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        # Skip auth for health checks and docs
        path = scope.get("path", "")
        if path in ["/health", "/docs", "/redoc", "/openapi.json", "/metrics"]:
            await self.app(scope, receive, send)
            return
        
        # For now, pass through all requests
        # In production, implement proper middleware auth logic
        await self.app(scope, receive, send)