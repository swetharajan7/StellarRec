from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import traceback
from typing import Dict, Any

logger = structlog.get_logger()

class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
            
        except HTTPException as e:
            # HTTP exceptions are handled by FastAPI
            raise
            
        except Exception as e:
            # Log the error
            request_id = getattr(request.state, 'request_id', 'unknown')
            
            logger.error(
                "Unhandled exception",
                request_id=request_id,
                method=request.method,
                url=str(request.url),
                error=str(e),
                traceback=traceback.format_exc()
            )
            
            # Return generic error response
            error_response = self._create_error_response(e, request_id)
            return JSONResponse(
                status_code=500,
                content=error_response
            )
    
    def _create_error_response(self, error: Exception, request_id: str) -> Dict[str, Any]:
        """Create standardized error response"""
        
        error_type = type(error).__name__
        
        # Don't expose internal errors in production
        if hasattr(error, 'detail'):
            message = error.detail
        else:
            message = "An internal server error occurred"
        
        return {
            "error": {
                "type": error_type,
                "message": message,
                "request_id": request_id,
                "timestamp": "2024-01-01T00:00:00Z"  # Would use actual timestamp
            }
        }