"""中间件"""

import time
import uuid
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 生成请求ID
        request_id = str(uuid.uuid4())[:8]
        
        # 记录请求开始时间
        start_time = time.perf_counter()
        
        # 绑定日志上下文
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        # 处理请求
        try:
            response = await call_next(request)
        except Exception as e:
            logger.exception("Request failed", error=str(e))
            raise
        
        # 计算处理时间
        process_time = (time.perf_counter() - start_time) * 1000
        
        # 添加响应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
        
        # 记录请求日志
        logger.info(
            "Request completed",
            status_code=response.status_code,
            process_time_ms=round(process_time, 2),
        )
        
        return response
