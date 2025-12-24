"""更新官方场景的可见性设置"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import update
from app.db.session import async_session_factory
from app.models.scenario import Scenario


async def update_official_scenarios():
    """将所有现有场景设置为官方场景并公开"""
    async with async_session_factory() as session:
        # 更新所有场景为官方公开场景
        result = await session.execute(
            update(Scenario)
            .where(Scenario.status == "published")
            .values(
                visibility="public",
                is_official=True,
            )
        )
        
        await session.commit()
        print(f"✓ 已更新 {result.rowcount} 个场景为官方公开场景")


async def main():
    print("=" * 50)
    print("更新官方场景设置")
    print("=" * 50)

    try:
        await update_official_scenarios()
        print("=" * 50)
        print("更新完成!")
    except Exception as e:
        print(f"✗ 更新失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
