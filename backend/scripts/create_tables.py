#!/usr/bin/env python3
"""
临时脚本:直接创建所有数据库表
用于绕过Alembic迁移bug
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.db.base import Base
from app.models import *  # noqa: F401, F403 - 导入所有模型


async def create_all_tables():
    """创建所有表"""
    print("=" * 50)
    print("  创建数据库表 (Base.metadata.create_all)")
    print("=" * 50)
    print()
    
    # 创建引擎
    engine = create_async_engine(settings.database_url, echo=True)
    
    try:
        # 创建所有表
        print("[1/3] 创建所有表...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("  ✓ 所有表创建成功!")
        print()
        
        # 插入alembic_version记录(标记迁移已完成)
        print("[2/3] 插入alembic_version记录...")
        async with engine.begin() as conn:
            # 检查表是否存在
            result = await conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_name = 'alembic_version')"
            ))
            exists = result.scalar()
            
            if exists:
                # 插入或更新版本记录
                await conn.execute(text(
                    "INSERT INTO alembic_version (version_num) VALUES ('101bb114a2f6') "
                    "ON CONFLICT (version_num) DO NOTHING"
                ))
                print("  ✓ Alembic版本记录已插入")
            else:
                print("  ! Alembic_version表不存在,跳过版本记录")
        print()
        
        # 验证表创建
        print("[3/3] 验证表创建...")
        async with engine.connect() as conn:
            result = await conn.execute(text(
                "SELECT count(*) FROM information_schema.tables "
                "WHERE table_schema = 'public'"
            ))
            table_count = result.scalar()
            print(f"  ✓ 成功创建 {table_count} 张表")
        print()
        
        print("=" * 50)
        print("  数据库表创建完成!")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n[ERROR] 创建表失败: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_all_tables())
