"""
开发：Excellent（11964948@qq.com）
功能：兑换码数据库模型
作用：定义兑换码和兑换记录数据结构
创建时间：2024-12-24
最后修改：2024-12-24
"""

import secrets
import string
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RewardType(str, Enum):
    """奖励类型"""
    VIP_DAYS = "vip_days"  # VIP天数
    POINTS = "points"  # 积分


def generate_redeem_code(length: int = 12) -> str:
    """生成随机兑换码"""
    # 使用大写字母和数字，排除容易混淆的字符 (0, O, I, L)
    chars = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    return "".join(secrets.choice(chars) for _ in range(length))


class RedeemCode(Base):
    """兑换码"""
    __tablename__ = "redeem_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # 奖励配置
    reward_type: Mapped[str] = mapped_column(String(20))  # vip_days, points
    reward_value: Mapped[int] = mapped_column(Integer)  # VIP天数或积分数量
    
    # VIP相关 (仅当 reward_type 为 vip_days 时有效)
    vip_level: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 指定VIP等级，null表示使用默认等级
    
    # 使用限制
    usage_limit: Mapped[int] = mapped_column(Integer, default=1)  # 使用次数限制，-1为无限
    used_count: Mapped[int] = mapped_column(Integer, default=0)  # 已使用次数
    per_user_limit: Mapped[int] = mapped_column(Integer, default=1)  # 每用户使用次数限制
    
    # 有效期
    valid_from: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    valid_until: Mapped[datetime] = mapped_column(DateTime)
    
    # 状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # 备注
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)  # 批次ID，用于批量生成
    
    # 创建信息
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # 关系
    creator: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by], backref="created_redeem_codes"
    )
    redeem_logs: Mapped[list["RedeemLog"]] = relationship(
        "RedeemLog", back_populates="redeem_code", cascade="all, delete-orphan"
    )

    @property
    def is_valid(self) -> bool:
        """检查兑换码是否有效"""
        now = datetime.utcnow()
        return (
            self.is_active
            and self.valid_from <= now <= self.valid_until
            and (self.usage_limit == -1 or self.used_count < self.usage_limit)
        )

    @property
    def remaining_uses(self) -> int:
        """剩余使用次数"""
        if self.usage_limit == -1:
            return -1  # 无限
        return max(0, self.usage_limit - self.used_count)

    @property
    def is_expired(self) -> bool:
        """是否已过期"""
        return datetime.utcnow() > self.valid_until

    @property
    def is_exhausted(self) -> bool:
        """是否已用完"""
        return self.usage_limit != -1 and self.used_count >= self.usage_limit


class RedeemLog(Base):
    """兑换记录"""
    __tablename__ = "redeem_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("redeem_codes.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    
    # 兑换时的奖励信息 (冗余存储，防止兑换码被修改)
    reward_type: Mapped[str] = mapped_column(String(20))
    reward_value: Mapped[int] = mapped_column(Integer)
    
    # 兑换结果
    vip_extended_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # VIP延长到的日期
    points_added: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 增加的积分
    
    # 兑换时间
    redeemed_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # IP地址 (用于安全审计)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 关系
    redeem_code: Mapped["RedeemCode"] = relationship(
        "RedeemCode", back_populates="redeem_logs"
    )
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], backref="redeem_logs"
    )
