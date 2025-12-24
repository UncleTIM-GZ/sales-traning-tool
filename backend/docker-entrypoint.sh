#!/bin/bash
# ================================================
# 后端容器启动脚本
# 自动运行数据库迁移和种子数据初始化后启动应用
# ================================================

set -e

echo "================================================"
echo "  销冠培养系统 - 后端服务启动"
echo "================================================"

# 等待数据库就绪
echo "[1/4] 等待数据库连接..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def check_db():
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        await conn.execute(text('SELECT 1'))
    await engine.dispose()

asyncio.run(check_db())
" 2>/dev/null; then
        echo "  数据库连接成功!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  等待数据库... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "  [ERROR] 数据库连接超时!"
    exit 1
fi

# 运行数据库迁移
echo "[2/4] 运行数据库迁移..."
if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
    echo "  跳过迁移 (SKIP_MIGRATIONS=true)"
else
    # 使用 Alembic 进行数据库迁移
    echo "  运行 Alembic 迁移..."
    alembic upgrade head
    if [ $? -eq 0 ]; then
        echo "  数据库迁移完成!"
    else
        echo "  [WARN] Alembic 迁移失败，尝试使用 create_all 作为备选方案..."
        python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from app.db.base import Base
import app.models

async def create_tables():
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

asyncio.run(create_tables())
"
        echo "  数据库表创建完成 (备选方案)!"
    fi
fi

# 运行种子数据初始化
echo "[3/4] 初始化种子数据..."
if [ "${SKIP_SEED:-false}" = "true" ]; then
    echo "  跳过种子数据 (SKIP_SEED=true)"
else
    # 基础数据：管理员、系统配置、会员等级、成就
    echo "  [3.1] 初始化基础数据..."
    python scripts/seed_data.py
    
    # 场景数据：30个训练场景
    echo "  [3.2] 初始化场景数据..."
    python -m scripts.seed_scenarios_full
    
    # 课程和社区数据：课程、挑战、排行榜
    echo "  [3.3] 初始化课程和社区数据..."
    python -m scripts.seed_all
    
    echo "  种子数据初始化完成!"
fi

# 启动应用
echo "[4/4] 启动应用服务..."
echo "================================================"
exec "$@"
