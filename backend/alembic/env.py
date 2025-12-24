"""
开发：Excellent（11964948@qq.com）
功能：Alembic 环境配置
作用：配置数据库迁移环境，支持同步迁移模式，带强校验
创建时间：2024-12-24
最后修改：2024-12-24

重要说明:
- 使用同步驱动 psycopg2 执行迁移（更稳定）
- 迁移前后会打印数据库地址和表数量，便于验证
- 开发环境端口: PostgreSQL 8108, Redis 8109
"""

import sys
from logging.config import fileConfig
from urllib.parse import urlparse

from sqlalchemy import engine_from_config, pool, text, create_engine

from alembic import context

# 导入模型
from app.db.base import Base
from app.models import *  # noqa: F401, F403
from app.config import settings

# Alembic Config对象
config = context.config

# 将异步 URL 转换为同步 URL (asyncpg -> psycopg2)
async_url = settings.database_url
sync_url = async_url.replace("postgresql+asyncpg", "postgresql+psycopg2")
config.set_main_option("sqlalchemy.url", sync_url)

# 日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 目标元数据
target_metadata = Base.metadata


def get_db_info(url: str) -> str:
    """解析数据库 URL，返回可读的连接信息"""
    parsed = urlparse(url)
    return f"{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}"


def count_tables_standalone(url: str) -> int:
    """使用独立连接统计表数量（不受事务影响）"""
    engine = create_engine(url)
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        ))
        count = result.scalar()
    engine.dispose()
    return count


def run_migrations_offline() -> None:
    """离线模式运行迁移 - 生成 SQL 脚本"""
    url = config.get_main_option("sqlalchemy.url")
    
    print(f"\n{'='*60}")
    print(f"[OFFLINE MODE] 生成迁移 SQL 脚本")
    print(f"目标数据库: {get_db_info(url)}")
    print(f"{'='*60}\n")
    
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式运行迁移 - 直接执行，带强校验"""
    url = config.get_main_option("sqlalchemy.url")
    db_info = get_db_info(url)
    
    print(f"\n{'='*60}")
    print(f"[MIGRATION] 数据库迁移")
    print(f"{'='*60}")
    print(f"目标数据库: {db_info}")
    print(f"同步驱动: psycopg2")
    print(f"{'='*60}\n")
    
    # 迁移前统计（独立连接）
    tables_before = count_tables_standalone(url)
    print(f"[PRE-CHECK] 迁移前表数量: {tables_before}")
    
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()
    
    connectable.dispose()
    
    # 迁移后统计（独立连接，确保看到已提交的数据）
    tables_after = count_tables_standalone(url)
    print(f"[POST-CHECK] 迁移后表数量: {tables_after}")
    
    # 校验结果
    if tables_after == 0:
        print(f"\n[WARNING] 数据库中没有表！请检查:")
        print(f"  1. 数据库地址是否正确: {db_info}")
        print(f"  2. Docker 容器是否运行: docker ps | grep postgres")
        print(f"  3. 端口映射是否正确: 开发环境应为 8108")
        sys.exit(1)
    
    tables_created = tables_after - tables_before
    if tables_created > 0:
        print(f"[SUCCESS] 新建 {tables_created} 个表")
    elif tables_before == tables_after and tables_after > 0:
        print(f"[INFO] 数据库已是最新状态，无需迁移")
    
    print(f"\n{'='*60}")
    print(f"[DONE] 迁移完成 - {db_info}")
    print(f"{'='*60}\n")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
