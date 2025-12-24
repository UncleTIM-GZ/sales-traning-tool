"""
开发：Excellent（11964948@qq.com）
功能：登录限流器
作用：防止暴力破解攻击，实现登录失败次数限制和账户锁定
创建时间：2024-12-24
最后修改：2024-12-24
"""

import time
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict
import asyncio


@dataclass
class LoginAttempt:
    """登录尝试记录"""
    count: int = 0
    first_attempt: float = 0.0
    locked_until: float = 0.0


class LoginRateLimiter:
    """
    登录限流器
    
    规则：
    - 5次失败后锁定账户15分钟
    - 10次失败后锁定账户1小时
    - 20次失败后锁定账户24小时
    - 成功登录后重置计数
    """
    
    # 限流配置
    LOCKOUT_THRESHOLDS = [
        (5, 15 * 60),      # 5次失败 -> 锁定15分钟
        (10, 60 * 60),     # 10次失败 -> 锁定1小时
        (20, 24 * 60 * 60) # 20次失败 -> 锁定24小时
    ]
    
    # 时间窗口（秒）- 在此时间内的失败次数会被累计
    WINDOW_SIZE = 24 * 60 * 60  # 24小时
    
    def __init__(self):
        # 内存存储（生产环境应使用 Redis）
        self._attempts: dict[str, LoginAttempt] = defaultdict(LoginAttempt)
        self._lock = asyncio.Lock()
    
    def _get_key(self, identifier: str, ip: Optional[str] = None) -> str:
        """生成限流键"""
        # 同时限制账户和IP
        return f"login:{identifier}"
    
    def _get_ip_key(self, ip: str) -> str:
        """生成IP限流键"""
        return f"login_ip:{ip}"
    
    async def check_rate_limit(
        self, 
        identifier: str, 
        ip: Optional[str] = None
    ) -> tuple[bool, Optional[str], Optional[int]]:
        """
        检查是否被限流
        
        Args:
            identifier: 用户标识（手机号）
            ip: 客户端IP
            
        Returns:
            (is_allowed, error_message, remaining_seconds)
        """
        async with self._lock:
            now = time.time()
            
            # 检查账户限流
            account_key = self._get_key(identifier)
            attempt = self._attempts[account_key]
            
            # 检查是否在锁定期
            if attempt.locked_until > now:
                remaining = int(attempt.locked_until - now)
                minutes = remaining // 60
                if minutes > 0:
                    return False, f"账户已被锁定，请{minutes}分钟后重试", remaining
                else:
                    return False, f"账户已被锁定，请{remaining}秒后重试", remaining
            
            # 检查IP限流（每IP每分钟最多10次尝试）
            if ip:
                ip_key = self._get_ip_key(ip)
                ip_attempt = self._attempts[ip_key]
                
                # 重置过期的IP计数
                if now - ip_attempt.first_attempt > 60:
                    ip_attempt.count = 0
                    ip_attempt.first_attempt = now
                
                if ip_attempt.count >= 10:
                    return False, "请求过于频繁，请稍后重试", 60
            
            return True, None, None
    
    async def record_failure(
        self, 
        identifier: str, 
        ip: Optional[str] = None
    ) -> tuple[int, Optional[int]]:
        """
        记录登录失败
        
        Args:
            identifier: 用户标识
            ip: 客户端IP
            
        Returns:
            (failure_count, lockout_seconds)
        """
        async with self._lock:
            now = time.time()
            account_key = self._get_key(identifier)
            attempt = self._attempts[account_key]
            
            # 重置过期的计数
            if now - attempt.first_attempt > self.WINDOW_SIZE:
                attempt.count = 0
                attempt.first_attempt = now
            
            # 增加失败计数
            if attempt.count == 0:
                attempt.first_attempt = now
            attempt.count += 1
            
            # 检查是否需要锁定
            lockout_seconds = None
            for threshold, duration in self.LOCKOUT_THRESHOLDS:
                if attempt.count >= threshold:
                    attempt.locked_until = now + duration
                    lockout_seconds = duration
            
            # 记录IP失败
            if ip:
                ip_key = self._get_ip_key(ip)
                ip_attempt = self._attempts[ip_key]
                if now - ip_attempt.first_attempt > 60:
                    ip_attempt.count = 0
                    ip_attempt.first_attempt = now
                ip_attempt.count += 1
            
            return attempt.count, lockout_seconds
    
    async def record_success(self, identifier: str, ip: Optional[str] = None):
        """记录登录成功，重置计数"""
        async with self._lock:
            account_key = self._get_key(identifier)
            if account_key in self._attempts:
                del self._attempts[account_key]
            
            # 重置IP计数
            if ip:
                ip_key = self._get_ip_key(ip)
                if ip_key in self._attempts:
                    del self._attempts[ip_key]
    
    async def get_remaining_attempts(self, identifier: str) -> int:
        """获取剩余尝试次数"""
        async with self._lock:
            account_key = self._get_key(identifier)
            attempt = self._attempts[account_key]
            
            # 找到下一个锁定阈值
            for threshold, _ in self.LOCKOUT_THRESHOLDS:
                if attempt.count < threshold:
                    return threshold - attempt.count
            
            return 0


# 全局限流器实例
login_rate_limiter = LoginRateLimiter()
