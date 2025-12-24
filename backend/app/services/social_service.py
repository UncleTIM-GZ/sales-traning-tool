"""社交服务 - 分享与邀请"""

import random
import string
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import InviteCode, Referral, ShareRecord
from app.models.incentive import UserPoints, PointTransaction
from app.services.incentive_service import IncentiveService


class SocialService:
    """社交服务"""

    # 邀请奖励
    REFERRER_REGISTER_POINTS = 100  # 邀请者：被邀请人注册
    REFERRER_COMPLETE_POINTS = 50   # 邀请者：被邀请人完成首次对练
    REFEREE_REGISTER_POINTS = 50    # 被邀请者：注册奖励

    def __init__(self, db: AsyncSession):
        self.db = db

    # ===== 邀请码管理 =====

    async def get_or_create_invite_code(self, user_id: str) -> InviteCode:
        """获取或创建用户邀请码"""
        # 检查是否已有邀请码
        result = await self.db.execute(
            select(InviteCode).where(
                InviteCode.user_id == user_id,
                InviteCode.is_active == True,
            )
        )
        invite_code = result.scalar_one_or_none()
        
        if invite_code:
            return invite_code
        
        # 生成新邀请码
        code = await self._generate_unique_code()
        invite_code = InviteCode(
            user_id=user_id,
            code=code,
        )
        self.db.add(invite_code)
        await self.db.commit()
        await self.db.refresh(invite_code)
        
        return invite_code

    async def _generate_unique_code(self, length: int = 8) -> str:
        """生成唯一邀请码"""
        chars = string.ascii_uppercase + string.digits
        for _ in range(10):  # 最多尝试10次
            code = ''.join(random.choices(chars, k=length))
            # 检查唯一性
            result = await self.db.execute(
                select(InviteCode).where(InviteCode.code == code)
            )
            if not result.scalar_one_or_none():
                return code
        raise ValueError("Failed to generate unique invite code")

    async def validate_invite_code(self, code: str) -> InviteCode | None:
        """验证邀请码"""
        result = await self.db.execute(
            select(InviteCode).where(
                InviteCode.code == code,
                InviteCode.is_active == True,
            )
        )
        invite_code = result.scalar_one_or_none()
        
        if not invite_code:
            return None
        
        # 检查使用次数限制
        if invite_code.max_uses > 0 and invite_code.use_count >= invite_code.max_uses:
            return None
        
        return invite_code

    # ===== 邀请流程 =====

    async def register_referral(
        self,
        invite_code: str,
        referee_id: str,
    ) -> Referral | None:
        """注册邀请关系（新用户注册时调用）"""
        # 验证邀请码
        code_obj = await self.validate_invite_code(invite_code)
        if not code_obj:
            return None
        
        # 不能邀请自己
        if code_obj.user_id == referee_id:
            return None
        
        # 创建邀请记录
        referral = Referral(
            referrer_id=code_obj.user_id,
            referee_id=referee_id,
            invite_code=invite_code,
            status="registered",
            registered_at=datetime.now(),
        )
        self.db.add(referral)
        
        # 更新邀请码使用次数
        await self.db.execute(
            update(InviteCode)
            .where(InviteCode.id == code_obj.id)
            .values(use_count=InviteCode.use_count + 1)
        )
        
        await self.db.commit()
        await self.db.refresh(referral)
        
        # 发放注册奖励
        await self._claim_register_rewards(referral)
        
        return referral

    async def _claim_register_rewards(self, referral: Referral):
        """发放注册奖励"""
        incentive = IncentiveService(self.db)
        
        # 邀请者奖励
        await incentive.add_points(
            user_id=referral.referrer_id,
            points=self.REFERRER_REGISTER_POINTS,
            action_type="referral_register",
            description=f"邀请好友注册奖励",
        )
        referral.referrer_reward_claimed = True
        
        # 被邀请者奖励
        await incentive.add_points(
            user_id=referral.referee_id,
            points=self.REFEREE_REGISTER_POINTS,
            action_type="referee_bonus",
            description="新用户邀请奖励",
        )
        referral.referee_reward_claimed = True
        
        await self.db.commit()

    async def complete_referral(self, referee_id: str):
        """完成邀请（被邀请人完成首次对练时调用）"""
        # 查找邀请记录
        result = await self.db.execute(
            select(Referral).where(
                Referral.referee_id == referee_id,
                Referral.status == "registered",
            )
        )
        referral = result.scalar_one_or_none()
        
        if not referral:
            return
        
        # 更新状态
        referral.status = "completed"
        referral.completed_at = datetime.now()
        
        # 发放额外奖励给邀请者
        incentive = IncentiveService(self.db)
        await incentive.add_points(
            user_id=referral.referrer_id,
            points=self.REFERRER_COMPLETE_POINTS,
            action_type="referral_complete",
            description="邀请好友完成首次对练奖励",
        )
        
        await self.db.commit()

    # ===== 邀请统计 =====

    async def get_referral_stats(self, user_id: str) -> dict:
        """获取用户邀请统计"""
        # 邀请总数
        total_result = await self.db.execute(
            select(func.count(Referral.id)).where(Referral.referrer_id == user_id)
        )
        total = total_result.scalar() or 0
        
        # 已完成数
        completed_result = await self.db.execute(
            select(func.count(Referral.id)).where(
                Referral.referrer_id == user_id,
                Referral.status == "completed",
            )
        )
        completed = completed_result.scalar() or 0
        
        # 获得积分
        points_result = await self.db.execute(
            select(func.sum(PointTransaction.amount)).where(
                PointTransaction.user_id == user_id,
                PointTransaction.type.in_(["referral_register", "referral_complete"]),
            )
        )
        points_earned = points_result.scalar() or 0
        
        return {
            "total_invites": total,
            "completed_invites": completed,
            "points_earned": points_earned,
        }

    async def get_referral_list(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Referral], int]:
        """获取邀请列表"""
        # 总数
        count_result = await self.db.execute(
            select(func.count(Referral.id)).where(Referral.referrer_id == user_id)
        )
        total = count_result.scalar() or 0
        
        # 列表
        result = await self.db.execute(
            select(Referral)
            .where(Referral.referrer_id == user_id)
            .order_by(Referral.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        referrals = list(result.scalars().all())
        
        return referrals, total

    # ===== 分享记录 =====

    async def record_share(
        self,
        user_id: str,
        share_type: str,
        channel: str,
        content_id: str | None = None,
        share_url: str | None = None,
    ) -> ShareRecord:
        """记录分享行为"""
        share = ShareRecord(
            user_id=user_id,
            share_type=share_type,
            content_id=content_id,
            channel=channel,
            share_url=share_url,
        )
        self.db.add(share)
        await self.db.commit()
        await self.db.refresh(share)
        
        # TODO: 首次分享可以加积分
        
        return share

    async def get_share_stats(self, user_id: str) -> dict:
        """获取分享统计"""
        result = await self.db.execute(
            select(func.count(ShareRecord.id)).where(ShareRecord.user_id == user_id)
        )
        total = result.scalar() or 0
        
        # 按类型统计
        type_result = await self.db.execute(
            select(ShareRecord.share_type, func.count(ShareRecord.id))
            .where(ShareRecord.user_id == user_id)
            .group_by(ShareRecord.share_type)
        )
        by_type = {row[0]: row[1] for row in type_result.all()}
        
        return {
            "total_shares": total,
            "by_type": by_type,
        }
