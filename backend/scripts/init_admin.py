"""初始化数据库并创建默认管理员"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.db.session import engine, async_session_factory
from app.core.security import get_password_hash
from app.models.user import User, Profile


# 默认管理员配置
ADMIN_PHONE = "13800138000"
ADMIN_PASSWORD = "123456"
ADMIN_NICKNAME = "系统管理员"


async def create_tables():
    """创建数据库表"""
    from app.db.base import Base
    from app.models import User, Profile, VerificationCode  # 确保导入所有模型
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ 数据库表创建成功")


async def create_admin():
    """创建默认管理员账户"""
    async with async_session_factory() as session:
        # 检查管理员是否已存在
        result = await session.execute(
            text("SELECT id, role FROM users WHERE phone = :phone"),
            {"phone": ADMIN_PHONE}
        )
        existing = result.first()
        
        if existing:
            # 如果用户存在但不是管理员，更新为管理员
            if existing[1] != "admin":
                await session.execute(
                    text("UPDATE users SET role = 'admin', nickname = :nickname, level = :level WHERE phone = :phone"),
                    {"phone": ADMIN_PHONE, "nickname": ADMIN_NICKNAME, "level": "超级管理员"}
                )
                await session.commit()
                print(f"✓ 已将 {ADMIN_PHONE} 更新为管理员")
            else:
                print(f"✓ 管理员账户已存在 (手机号: {ADMIN_PHONE})")
            return
        
        # 创建管理员
        admin = User(
            phone=ADMIN_PHONE,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            nickname=ADMIN_NICKNAME,
            track="sales",
            role="admin",
            level="超级管理员",
        )
        session.add(admin)
        await session.flush()
        
        # 创建用户画像
        profile = Profile(
            user_id=admin.id,
            baseline_score=100,
            onboarding_completed=True,
        )
        session.add(profile)
        await session.commit()
        
        print(f"✓ 默认管理员创建成功")
        print(f"  手机号: {ADMIN_PHONE}")
        print(f"  密码: {ADMIN_PASSWORD}")
        print(f"  (登录后请及时修改密码)")


async def main():
    print("=" * 50)
    print("初始化数据库")
    print("=" * 50)
    
    try:
        await create_tables()
        await create_admin()
        print("=" * 50)
        print("初始化完成!")
    except Exception as e:
        print(f"✗ 初始化失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
