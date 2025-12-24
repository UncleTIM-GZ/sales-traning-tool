"""
开发：Excellent（11964948@qq.com）
功能：数据库种子数据脚本
作用：初始化默认管理员账户、系统配置、会员等级等基础数据
创建时间：2024-12-24
最后修改：2024-12-24

使用方法:
    cd backend && source .venv/bin/activate && python scripts/seed_data.py
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Profile
from app.models.system_config import SystemConfig
from app.models.membership import MembershipLevel, DEFAULT_MEMBERSHIP_LEVELS
from app.models.incentive import Achievement


async def seed_admin_user(session: AsyncSession) -> None:
    """创建默认管理员账户"""
    # 检查是否已存在
    result = await session.execute(
        select(User).where(User.phone == "13800000000")
    )
    if result.scalar_one_or_none():
        print("  [SKIP] 管理员账户已存在")
        return
    
    # 创建管理员
    admin_id = str(uuid4())
    admin = User(
        id=admin_id,
        phone="13800000000",
        hashed_password=get_password_hash("admin123"),
        nickname="系统管理员",
        track="sales",
        role="admin",
        level="超级管理员",
        is_active=True,
    )
    session.add(admin)
    
    # 创建管理员画像
    profile = Profile(
        id=str(uuid4()),
        user_id=admin_id,
        baseline_score=100.0,
        weak_dimensions=[],
        preferences={},
        onboarding_completed=True,
        baseline_completed=True,
    )
    session.add(profile)
    
    await session.commit()
    print("  [OK] 创建管理员账户: 13800000000 / admin123")


async def seed_system_configs(session: AsyncSession) -> None:
    """创建默认系统配置"""
    configs = [
        {
            "key": "login_config",
            "value": {"sms_login_enabled": False, "password_login_enabled": True},
            "description": "登录方式配置",
        },
        {
            "key": "sms_config",
            "value": {
                "enabled": False,
                "access_key_id": "",
                "access_key_secret": "",
                "sign_name": "",
                "template_code": "",
            },
            "description": "阿里云短信服务配置",
        },
        {
            "key": "points_config",
            "value": {
                "daily_login": 10,
                "training_complete_min": 20,
                "training_complete_max": 50,
                "course_complete": 30,
                "scenario_share": 50,
                "scenario_like": 5,
                "invite_register": 100,
                "vip_purchase_rate": 0.1,
                "daily_earn_limit": 500,
                "points_to_yuan": 100,
                "max_discount_rate": 0.5,
            },
            "description": "积分规则配置",
        },
        {
            "key": "checkin_config",
            "value": {
                "base_points": 5,
                "streak_bonus": {
                    "3": 5,
                    "7": 10,
                    "14": 20,
                    "30": 50,
                    "60": 100,
                    "90": 200,
                },
                "max_streak_bonus": 200,
                "enabled": True,
            },
            "description": "签到配置",
        },
        {
            "key": "payment_config",
            "value": {
                "wechat_enabled": False,
                "alipay_enabled": False,
                "order_expire_minutes": 30,
                "refund_days_limit": 7,
            },
            "description": "支付配置",
        },
    ]
    
    for config_data in configs:
        result = await session.execute(
            select(SystemConfig).where(SystemConfig.key == config_data["key"])
        )
        if result.scalar_one_or_none():
            print(f"  [SKIP] 配置已存在: {config_data['key']}")
            continue
        
        config = SystemConfig(
            id=str(uuid4()),
            key=config_data["key"],
            value=config_data["value"],
            description=config_data["description"],
        )
        session.add(config)
        print(f"  [OK] 创建配置: {config_data['key']}")
    
    await session.commit()


async def seed_membership_levels(session: AsyncSession) -> None:
    """创建默认会员等级"""
    for level_data in DEFAULT_MEMBERSHIP_LEVELS:
        result = await session.execute(
            select(MembershipLevel).where(MembershipLevel.name == level_data["name"])
        )
        if result.scalar_one_or_none():
            print(f"  [SKIP] 会员等级已存在: {level_data['display_name']}")
            continue
        
        level = MembershipLevel(
            id=str(uuid4()),
            name=level_data["name"],
            display_name=level_data["display_name"],
            description=level_data["description"],
            price_monthly=level_data["price_monthly"],
            price_quarterly=level_data["price_quarterly"],
            price_half_yearly=level_data["price_half_yearly"],
            price_yearly=level_data["price_yearly"],
            privileges=level_data["privileges"],
            sort_order=level_data["sort_order"],
            is_active=True,
        )
        session.add(level)
        print(f"  [OK] 创建会员等级: {level_data['display_name']}")
    
    await session.commit()


async def seed_achievements(session: AsyncSession) -> None:
    """创建默认成就"""
    achievements = [
        {
            "name": "新手上路",
            "description": "完成首次场景对练",
            "icon": "target",
            "category": "session",
            "condition": {"type": "sessions_count", "value": 1},
            "points_reward": 10,
            "rarity": "common",
            "sort_order": 1,
        },
        {
            "name": "初级新星",
            "description": "完成 5 次场景对练",
            "icon": "star",
            "category": "session",
            "condition": {"type": "sessions_count", "value": 5},
            "points_reward": 25,
            "rarity": "common",
            "sort_order": 2,
        },
        {
            "name": "进阶达人",
            "description": "完成 20 次场景对练",
            "icon": "medal",
            "category": "session",
            "condition": {"type": "sessions_count", "value": 20},
            "points_reward": 50,
            "rarity": "rare",
            "sort_order": 3,
        },
        {
            "name": "训练大师",
            "description": "完成 50 次场景对练",
            "icon": "trophy",
            "category": "session",
            "condition": {"type": "sessions_count", "value": 50},
            "points_reward": 100,
            "rarity": "epic",
            "sort_order": 4,
        },
        {
            "name": "稳步前行",
            "description": "连续打卡 3 天",
            "icon": "flame",
            "category": "streak",
            "condition": {"type": "streak_days", "value": 3},
            "points_reward": 15,
            "rarity": "common",
            "sort_order": 10,
        },
        {
            "name": "坚持不懈",
            "description": "连续打卡 7 天",
            "icon": "zap",
            "category": "streak",
            "condition": {"type": "streak_days", "value": 7},
            "points_reward": 35,
            "rarity": "rare",
            "sort_order": 11,
        },
        {
            "name": "自律德章",
            "description": "连续打卡 14 天",
            "icon": "award",
            "category": "streak",
            "condition": {"type": "streak_days", "value": 14},
            "points_reward": 70,
            "rarity": "epic",
            "sort_order": 12,
        },
        {
            "name": "铁人意志",
            "description": "连续打卡 30 天",
            "icon": "gem",
            "category": "streak",
            "condition": {"type": "streak_days", "value": 30},
            "points_reward": 150,
            "rarity": "legendary",
            "sort_order": 13,
        },
        {
            "name": "小试牛刀",
            "description": "单次测评得分 70+",
            "icon": "file-text",
            "category": "score",
            "condition": {"type": "score_above", "value": 70},
            "points_reward": 20,
            "rarity": "common",
            "sort_order": 20,
        },
        {
            "name": "超越平均",
            "description": "单次测评得分 80+",
            "icon": "bar-chart",
            "category": "score",
            "condition": {"type": "score_above", "value": 80},
            "points_reward": 40,
            "rarity": "rare",
            "sort_order": 21,
        },
        {
            "name": "优秀表现",
            "description": "单次测评得分 90+",
            "icon": "sparkles",
            "category": "score",
            "condition": {"type": "score_above", "value": 90},
            "points_reward": 80,
            "rarity": "epic",
            "sort_order": 22,
        },
        {
            "name": "完美表现",
            "description": "单次测评得分 95+",
            "icon": "crown",
            "category": "score",
            "condition": {"type": "score_above", "value": 95},
            "points_reward": 150,
            "rarity": "legendary",
            "sort_order": 23,
        },
    ]
    
    for ach_data in achievements:
        result = await session.execute(
            select(Achievement).where(Achievement.name == ach_data["name"])
        )
        if result.scalar_one_or_none():
            print(f"  [SKIP] 成就已存在: {ach_data['name']}")
            continue
        
        achievement = Achievement(
            id=str(uuid4()),
            name=ach_data["name"],
            description=ach_data["description"],
            icon=ach_data["icon"],
            category=ach_data["category"],
            condition=ach_data["condition"],
            points_reward=ach_data["points_reward"],
            rarity=ach_data["rarity"],
            sort_order=ach_data["sort_order"],
            is_active=True,
        )
        session.add(achievement)
        print(f"  [OK] 创建成就: {ach_data['name']}")
    
    await session.commit()


async def main():
    """主函数"""
    print("=" * 50)
    print("  销冠培养系统 - 数据库种子数据初始化")
    print("=" * 50)
    
    # 创建数据库引擎
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("\n[1/4] 创建管理员账户...")
        await seed_admin_user(session)
        
        print("\n[2/4] 创建系统配置...")
        await seed_system_configs(session)
        
        print("\n[3/4] 创建会员等级...")
        await seed_membership_levels(session)
        
        print("\n[4/4] 创建成就定义...")
        await seed_achievements(session)
    
    await engine.dispose()
    
    print("\n" + "=" * 50)
    print("  种子数据初始化完成!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
