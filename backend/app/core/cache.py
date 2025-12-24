"""Redis 缓存服务

提供统一的缓存接口，支持：
- 热点数据缓存（场景列表、排行榜等）
- 缓存过期时间配置
- JSON 序列化/反序列化
"""

import json
from datetime import timedelta
from typing import Any, TypeVar, Callable
from functools import wraps

import redis.asyncio as redis
import structlog

from app.config import settings

logger = structlog.get_logger()

T = TypeVar("T")

# 缓存时间配置
CACHE_TTL = {
    "scenario_list": timedelta(minutes=5),
    "scenario_detail": timedelta(minutes=10),
    "leaderboard": timedelta(minutes=2),
    "course_list": timedelta(minutes=30),
    "user_stats": timedelta(minutes=1),
    "dashboard_stats": timedelta(minutes=2),
    "default": timedelta(minutes=5),
}


class RedisCache:
    """Redis 缓存管理器"""

    _instance: "RedisCache | None" = None
    _pool: redis.ConnectionPool | None = None
    _client: redis.Redis | None = None

    def __new__(cls) -> "RedisCache":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        """建立 Redis 连接"""
        if self._client is not None:
            return

        try:
            self._pool = redis.ConnectionPool.from_url(
                settings.redis_url,
                max_connections=10,
                decode_responses=True,
            )
            self._client = redis.Redis(connection_pool=self._pool)
            # 测试连接
            await self._client.ping()
            logger.info("Redis cache connected", url=settings.redis_url)
        except Exception as e:
            logger.warning("Redis connection failed, cache disabled", error=str(e))
            self._client = None

    async def disconnect(self) -> None:
        """断开连接"""
        if self._client:
            await self._client.close()
            self._client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None

    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._client is not None

    async def get(self, key: str) -> Any | None:
        """获取缓存值"""
        if not self._client:
            return None

        try:
            value = await self._client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.debug("Cache get failed", key=key, error=str(e))
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: timedelta | None = None,
        cache_type: str = "default",
    ) -> bool:
        """设置缓存值"""
        if not self._client:
            return False

        try:
            ttl = ttl or CACHE_TTL.get(cache_type, CACHE_TTL["default"])
            serialized = json.dumps(value, ensure_ascii=False, default=str)
            await self._client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.debug("Cache set failed", key=key, error=str(e))
            return False

    async def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self._client:
            return False

        try:
            await self._client.delete(key)
            return True
        except Exception as e:
            logger.debug("Cache delete failed", key=key, error=str(e))
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有键"""
        if not self._client:
            return 0

        try:
            keys = await self._client.keys(pattern)
            if keys:
                return await self._client.delete(*keys)
            return 0
        except Exception as e:
            logger.debug("Cache delete pattern failed", pattern=pattern, error=str(e))
            return 0

    async def clear_all(self) -> bool:
        """清除所有缓存"""
        if not self._client:
            return False

        try:
            await self._client.flushdb()
            return True
        except Exception as e:
            logger.debug("Cache clear failed", error=str(e))
            return False


# 全局缓存实例
cache = RedisCache()


def cache_key(*args: Any, prefix: str = "cache") -> str:
    """生成缓存键"""
    parts = [prefix] + [str(arg) for arg in args if arg is not None]
    return ":".join(parts)


def cached(
    prefix: str,
    cache_type: str = "default",
    ttl: timedelta | None = None,
):
    """缓存装饰器

    用法:
    ```python
    @cached("scenarios", cache_type="scenario_list")
    async def get_scenarios(track: str = None):
        ...
    ```
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            # 生成缓存键
            key_parts = [prefix]
            key_parts.extend(str(arg) for arg in args if arg is not None)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
            key = ":".join(key_parts)

            # 尝试从缓存获取
            if cache.is_connected:
                cached_value = await cache.get(key)
                if cached_value is not None:
                    logger.debug("Cache hit", key=key)
                    return cached_value

            # 执行原函数
            result = await func(*args, **kwargs)

            # 存入缓存
            if cache.is_connected and result is not None:
                await cache.set(key, result, ttl=ttl, cache_type=cache_type)
                logger.debug("Cache set", key=key)

            return result

        return wrapper

    return decorator


async def init_cache() -> None:
    """初始化缓存连接"""
    await cache.connect()


async def close_cache() -> None:
    """关闭缓存连接"""
    await cache.disconnect()
