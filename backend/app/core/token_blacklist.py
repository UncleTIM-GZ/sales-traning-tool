"""
开发：Excellent（11964948@qq.com）
功能：Token 黑名单管理
作用：支持强制登出、Token 失效等安全功能
创建时间：2024-12-24
最后修改：2024-12-24
"""

import time
import asyncio
from typing import Optional
from dataclasses import dataclass


@dataclass
class BlacklistedToken:
    """黑名单 Token 记录"""
    token_jti: str  # JWT ID
    user_id: str
    expires_at: float
    reason: str


class TokenBlacklist:
    """
    Token 黑名单管理器
    
    功能：
    - 将 Token 加入黑名单（强制登出）
    - 检查 Token 是否在黑名单中
    - 自动清理过期的黑名单记录
    
    注意：生产环境应使用 Redis 实现
    """
    
    def __init__(self):
        # 内存存储（生产环境应使用 Redis）
        self._blacklist: dict[str, BlacklistedToken] = {}
        self._user_tokens: dict[str, set[str]] = {}  # user_id -> set of token_jti
        self._lock = asyncio.Lock()
        self._cleanup_interval = 3600  # 1小时清理一次
        self._last_cleanup = time.time()
    
    async def add(
        self, 
        token_jti: str, 
        user_id: str, 
        expires_at: float,
        reason: str = "logout"
    ):
        """
        将 Token 加入黑名单
        
        Args:
            token_jti: JWT ID（从 token 的 jti claim 获取）
            user_id: 用户ID
            expires_at: Token 过期时间戳
            reason: 加入黑名单的原因
        """
        async with self._lock:
            self._blacklist[token_jti] = BlacklistedToken(
                token_jti=token_jti,
                user_id=user_id,
                expires_at=expires_at,
                reason=reason,
            )
            
            # 记录用户的 Token
            if user_id not in self._user_tokens:
                self._user_tokens[user_id] = set()
            self._user_tokens[user_id].add(token_jti)
            
            # 定期清理
            await self._maybe_cleanup()
    
    async def is_blacklisted(self, token_jti: str) -> bool:
        """检查 Token 是否在黑名单中"""
        async with self._lock:
            if token_jti not in self._blacklist:
                return False
            
            # 检查是否已过期（过期的可以移除）
            record = self._blacklist[token_jti]
            if record.expires_at < time.time():
                del self._blacklist[token_jti]
                return False
            
            return True
    
    async def revoke_all_user_tokens(self, user_id: str, expires_at: float, reason: str = "security"):
        """
        撤销用户的所有 Token
        
        用于：
        - 密码修改后强制重新登录
        - 账户被禁用
        - 安全事件响应
        """
        async with self._lock:
            # 标记该用户的所有 Token 为已撤销
            # 这里使用特殊标记，检查时会匹配用户ID
            special_jti = f"revoke_all:{user_id}:{int(time.time())}"
            self._blacklist[special_jti] = BlacklistedToken(
                token_jti=special_jti,
                user_id=user_id,
                expires_at=expires_at,
                reason=reason,
            )
    
    async def is_user_revoked(self, user_id: str, token_iat: float) -> bool:
        """
        检查用户的 Token 是否被批量撤销
        
        Args:
            user_id: 用户ID
            token_iat: Token 签发时间
        """
        async with self._lock:
            for jti, record in self._blacklist.items():
                if jti.startswith(f"revoke_all:{user_id}:"):
                    # 提取撤销时间
                    revoke_time = int(jti.split(":")[-1])
                    # 如果 Token 在撤销之前签发，则无效
                    if token_iat < revoke_time:
                        return True
            return False
    
    async def _maybe_cleanup(self):
        """定期清理过期记录"""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        
        self._last_cleanup = now
        expired_jtis = [
            jti for jti, record in self._blacklist.items()
            if record.expires_at < now
        ]
        
        for jti in expired_jtis:
            record = self._blacklist.pop(jti, None)
            if record and record.user_id in self._user_tokens:
                self._user_tokens[record.user_id].discard(jti)
    
    async def get_stats(self) -> dict:
        """获取黑名单统计信息"""
        async with self._lock:
            return {
                "total_blacklisted": len(self._blacklist),
                "users_affected": len(self._user_tokens),
            }


# 全局黑名单实例
token_blacklist = TokenBlacklist()
