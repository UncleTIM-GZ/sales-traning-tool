# 销冠培养系统 & 社恐培养系统

仓库地址：[https://github.com/shangyankeji/zhixun](https://github.com/shangyankeji/zhixun)

<div align="center">

**🎉 Qoder 创意挑战 · 第一期 🎉**

> 本项目由 **Qoder 社区** 小伙伴提供创意想法，使用 **[Qoder](https://qoder.ai)** 进行技术落地开发。
> 
> 这是一次 **"从创意到代码"** 的实践：社区贡献 idea，由我使用Qoder来开发技术落地，共同打造真正可用的产品。

---

**🌟 100% 开源 · 完全免费 · 可商用 🌟**

本项目采用 **MIT 协议** 开源，任何人都可以自由使用、修改、分发，包括商业用途。  
我们希望这个项目能帮助更多人提升销售与社交能力！

---

**AI 驱动的销售与社交能力培训平台**

基于多 Agent 协作的场景模拟训练系统

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-000000?style=flat&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [开发指南](#开发指南)
- [项目架构](#项目架构)
- [API 文档](#api-文档)
- [部署指南](#部署指南)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [开源协议](#开源协议)

---

## 项目简介

**销冠培养系统 (SCS - Sales Champion System)** 和 **社恐培养系统 (SCC - Social Confidence Cultivator)** 是一套基于 AI 多 Agent 协作的能力培训平台。

### 产品定位

- **SCS (销冠培养系统)**: 面向销售人员/组织的实战模拟训练营，提供电话邀约、需求挖掘、异议处理、谈判技巧等场景化训练
- **SCC (社恐培养系统)**: 面向职场人群/社交焦虑者的安全陪练系统，提供陌生社交、会议发言、冲突处理等阶梯式训练

### 核心价值

- **可控**: 导演 Agent 可调难度、注入事件、控制对话节奏
- **可比**: 固定种子的测评模式，支持训练前后对比
- **可追溯**: 评分引用证据句，会话完整可回放
- **可沉浸**: 实时语音对话，支持打断与断线重连
- **可运营**: 场景资产化，后台可编辑、投放、灰度发布

---

## 核心特性

### 1. 多 Agent 协作引擎

- **Director Agent (导演)**: 场景编排、难度控制、事件注入
- **NPC Agent (角色)**: 模拟客户、朋友、同事等对话角色
- **Evaluator Agent (评估师)**: 实时评估用户表现，生成量化评分
- **Coach Agent (教练)**: 提供个性化学习建议和改进方向
- **Safety Agent (安全检查)**: 内容安全过滤和合规检查
- **Memory Agent (记忆管理)**: 跨会话记忆和上下文管理

### 2. 三大训练模式

- **Train (训练模式)**: 刻意练习，支持暂停、提示、回放
- **Exam (测评模式)**: 固定场景评估，生成量化报告
- **Replay (复盘模式)**: 回放历史会话，对比改进轨迹

### 3. 实时语音对话

- 基于阿里云 Qwen-Omni-Realtime 模型
- WebSocket 实时通信，低延迟响应
- VAD (语音活动检测) 自动触发
- 支持对话打断和断线重连

### 4. 智能训练计划

- 个性化训练计划生成
- 自适应难度调整
- 学习进度跟踪
- 能力雷达图可视化

### 5. 课程与社区

- 结构化课程体系 (销售赋能/社交技能)
- 用户动态分享
- 排行榜与挑战赛
- 学习成就系统

### 6. 后台管理系统

- 用户管理与权限控制
- 场景编辑与版本管理
- 课程内容管理
- 数据统计与报表

---

## 技术栈

### 后端

- **框架**: FastAPI 0.115+ (异步高性能)
- **语言**: Python 3.11+
- **数据库**: PostgreSQL 16 (主数据库) + Redis 7 (缓存/队列)
- **ORM**: SQLAlchemy 2.0 (AsyncIO)
- **迁移**: Alembic
- **任务队列**: Celery (可选)
- **AI 模型**: 阿里云百炼 (DashScope) - 通义千问系列
- **日志**: structlog (结构化日志)

### 前端

- **框架**: Next.js 16.1 (App Router)
- **UI 库**: React 19.2
- **语言**: TypeScript 5.0+
- **样式**: Tailwind CSS 4
- **状态管理**: Zustand (持久化存储)
- **图标**: Lucide React
- **图表**: Recharts
- **表单**: React Hook Form + Zod
- **HTTP 客户端**: Axios + TanStack Query

### DevOps

- **容器化**: Docker + Docker Compose
- **代码规范**: Ruff (Python) + ESLint (TypeScript)
- **测试**: Pytest (后端) + Jest (前端)
- **类型检查**: Mypy (Python) + TypeScript

---

## 快速开始

### 前置要求

- **Node.js**: 20.x 或更高版本
- **Python**: 3.11 或更高版本
- **Docker**: 最新版本 (用于运行 PostgreSQL 和 Redis)
- **阿里云百炼 API Key**: [获取地址](https://bailian.console.aliyun.com/#/api-key)

### 一键启动 (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd xiaoshou

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写 DASHSCOPE_API_KEY

# 3. 启动数据库
make db

# 4. 安装依赖
make install

# 5. 运行数据库迁移
make migrate

# 6. 在新终端启动后端
make backend

# 7. 在新终端启动前端
make frontend
```

### 访问应用

- **前端**: http://localhost:8110
- **后端 API**: http://localhost:8111
- **API 文档**: http://localhost:8111/docs (Swagger UI)
- **备用文档**: http://localhost:8111/redoc (ReDoc)

### 默认管理员账号

首次启动后，运行以下命令初始化数据库（创建表结构 + 管理员账号 + 30个默认场景）：

```bash
./deploy.sh init-db
```

**默认管理员账号：**
```
手机号: 13800000000
密码:   admin123
```

**重要**: 生产环境请立即修改默认密码！

---

## 环境配置

### 后端环境变量

创建 `backend/.env` 文件 (参考 `.env.example`):

```bash
# 应用配置
APP_ENV=development
DEBUG=true

# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/asp_db
REDIS_URL=redis://localhost:6379/0

# JWT 认证
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRE_MINUTES=1440

# 阿里云百炼 (必填)
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_MODEL=qwen3-max
DASHSCOPE_REGION=beijing

# 实时语音对话
REALTIME_MODEL=qwen3-omni-flash-realtime
REALTIME_VOICE=Cherry
```

### 前端环境变量

创建 `frontend/.env.local` 文件:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8111/api/v1
```

### 国内镜像源配置 (可选)

```bash
# npm 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# pip 使用清华镜像
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 开发指南

### 开发命令

```bash
# 启动数据库 (PostgreSQL + Redis)
make db

# 启动后端开发服务器 (热重载)
make backend

# 启动前端开发服务器 (热重载)
make frontend

# 运行数据库迁移
make migrate

# 创建新迁移文件
make migrate-new

# 运行测试
make test

# 代码检查 (Linter)
make lint

# 代码格式化
make format

# 清理临时文件
make clean

# 停止所有服务
make stop
```

### 单独运行后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements-dev.txt

# 运行迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 单独运行前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm run start
```

### 数据库管理

```bash
# 创建新迁移
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "描述信息"

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1

# 查看迁移历史
alembic history
```

### 测试

```bash
# 运行后端测试
cd backend
source .venv/bin/activate
pytest -v

# 运行测试并生成覆盖率报告
pytest --cov=app --cov-report=html

# 运行特定测试文件
pytest tests/test_agents/test_npc.py -v
```

---

## 项目架构

### 后端架构

```
backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理 (Pydantic Settings)
│   ├── api/
│   │   ├── deps.py          # 依赖注入
│   │   └── v1/              # API v1 路由
│   │       ├── auth.py      # 认证相关
│   │       ├── users.py     # 用户管理
│   │       ├── courses.py   # 课程管理
│   │       ├── scenarios.py # 场景管理
│   │       ├── sessions.py  # 训练会话
│   │       ├── realtime.py  # 实时语音 (WebSocket)
│   │       ├── community.py # 社区功能
│   │       └── admin.py     # 后台管理
│   ├── models/              # SQLAlchemy 数据库模型
│   ├── schemas/             # Pydantic 数据模型 (请求/响应)
│   ├── services/            # 业务逻辑层
│   ├── agents/              # AI Agent 实现
│   │   ├── base.py          # Agent 基类
│   │   ├── director.py      # 导演 Agent
│   │   ├── npc.py           # NPC Agent
│   │   ├── evaluator.py     # 评估 Agent
│   │   ├── coach.py         # 教练 Agent
│   │   ├── orchestrator.py  # Agent 协调器
│   │   ├── safety.py        # 安全检查
│   │   └── memory.py        # 记忆管理
│   ├── providers/           # 外部服务提供者
│   │   └── llm/             # LLM 提供者 (DashScope)
│   ├── core/                # 核心功能
│   │   ├── security.py      # JWT 认证
│   │   ├── middleware.py    # 中间件
│   │   └── exceptions.py    # 异常处理
│   └── db/                  # 数据库连接
├── alembic/                 # 数据库迁移
├── tests/                   # 测试文件
└── requirements.txt         # 依赖列表
```

### 前端架构

```
frontend/src/
├── app/                     # Next.js App Router
│   ├── layout.tsx           # 全局布局
│   ├── (public)/            # 公开页面 (登录、注册)
│   ├── (main)/              # 主应用 (需认证)
│   │   ├── dashboard/       # 仪表盘
│   │   ├── courses/         # 课程中心
│   │   └── community/       # 社区广场
│   ├── admin/               # 后台管理
│   └── training/            # 训练页面
│       └── [id]/
│           ├── page.tsx     # 文字对话
│           └── voice/       # 语音对话
├── components/              # React 组件
│   ├── ui/                  # 基础 UI 组件
│   ├── admin/               # 后台管理组件
│   └── charts/              # 图表组件
├── lib/
│   ├── api.ts               # API 客户端
│   └── utils.ts             # 工具函数
├── stores/                  # Zustand 状态管理
│   └── authStore.ts         # 认证状态
├── hooks/                   # 自定义 Hooks
└── types/                   # TypeScript 类型
```

### 多 Agent 协作流程

```
用户输入
    ↓
[Safety Agent] ← 内容安全检查
    ↓
[Director Agent] ← 场景编排、事件注入
    ↓
[NPC Agent] ← 生成角色回复
    ↓
[Evaluator Agent] ← 评估用户表现
    ↓
[Coach Agent] ← 生成学习建议
    ↓
[Memory Agent] ← 记忆存储
    ↓
返回给用户
```

---

## API 文档

### 认证相关

```bash
# 用户注册
POST /api/v1/auth/register
Content-Type: application/json
{
  "phone": "13800138000",
  "password": "password123",
  "nickname": "张三",
  "track": "sales"  # 或 "social"
}

# 用户登录
POST /api/v1/auth/login
Content-Type: application/json
{
  "phone": "13800138000",
  "password": "password123"
}

# 响应
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "phone": "13800138000",
    "nickname": "张三",
    "track": "sales",
    "role": "user"
  }
}
```

### 会话管理

```bash
# 创建训练会话
POST /api/v1/sessions
Authorization: Bearer <token>
Content-Type: application/json
{
  "scenario_id": "uuid",
  "mode": "train"  # train/exam/replay
}

# 发送消息
POST /api/v1/sessions/{session_id}/message
Authorization: Bearer <token>
Content-Type: application/json
{
  "content": "你好，我想了解一下你们的产品"
}

# 实时语音对话 (WebSocket)
WS /api/v1/realtime/{session_id}
```

### 完整 API 文档

启动后端服务后访问:
- Swagger UI: http://localhost:8111/docs
- ReDoc: http://localhost:8111/redoc

---

## 部署指南

### 方式一：Docker 一键部署 (推荐)

适合快速部署和生产环境，无需手动配置依赖。

```bash
# 1. 克隆项目
git clone <repository-url>
cd xiaoshou

# 2. 配置环境变量
cp .env.production.example .env
# 编辑 .env 文件，填写必要的配置（特别是 DASHSCOPE_API_KEY）

# 3. 完整部署（首次安装）
./deploy.sh full-deploy
```

**部署脚本命令说明：**

| 命令 | 说明 |
|------|------|
| `./deploy.sh start` | 启动服务（默认） |
| `./deploy.sh stop` | 停止服务 |
| `./deploy.sh restart` | 重启服务 |
| `./deploy.sh rebuild` | 重新构建镜像并启动 |
| `./deploy.sh init-db` | 初始化数据库（创建表+管理员+30个场景） |
| `./deploy.sh upgrade` | 更新部署（代码更新后使用） |
| `./deploy.sh full-deploy` | 完整部署（首次安装一键完成） |
| `./deploy.sh logs` | 查看服务日志 |
| `./deploy.sh status` | 查看服务状态 |

**服务端口：**

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 8110 | Next.js 应用 |
| 后端 | 8111 | FastAPI API |
| PostgreSQL | 8108 | 数据库（Docker内部） |
| Redis | 8109 | 缓存（Docker内部） |

**访问地址：**
- 前端应用: http://localhost:8110
- 后端 API: http://localhost:8111
- API 文档: http://localhost:8111/docs

---

### 方式二：非 Docker 手动部署

适合开发调试或无法使用 Docker 的环境。

#### 前置要求

- **Node.js**: 20.x 或更高版本
- **Python**: 3.11 或更高版本
- **PostgreSQL**: 16+
- **Redis**: 7+

#### 步骤 1：安装数据库

**方式A：使用 Docker 运行数据库（推荐）**
```bash
# 只启动数据库，不启动应用
docker run -d --name postgres16 \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=asp_db \
  postgres:16-alpine

docker run -d --name redis7 \
  -p 6379:6379 \
  redis:7-alpine
```

**方式B：本地安装数据库**
```bash
# macOS (Homebrew)
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

createdb asp_db

# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib redis-server
sudo systemctl start postgresql redis-server
sudo -u postgres createdb asp_db
```

#### 步骤 2：配置后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 创建环境变量文件
cat > .env << 'EOF'
# 应用配置
APP_ENV=development
DEBUG=true

# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/asp_db
REDIS_URL=redis://localhost:6379/0

# JWT 认证
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRE_MINUTES=1440

# 阿里云百炼 (必填)
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_MODEL=qwen3-max
REALTIME_MODEL=qwen-omni-turbo-latest
REALTIME_VOICE=Cherry
EOF

# 创建数据库表
python -c "
import asyncio
from app.db.session import engine
from app.db.base import Base
import app.models

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created!')

asyncio.run(create_tables())
"

# 创建管理员账号
python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.config import settings
from app.core.security import get_password_hash
from app.models.user import User

async def create_admin():
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        result = await db.execute(select(User).where(User.phone == '13800000000'))
        if not result.scalar_one_or_none():
            db.add(User(phone='13800000000', hashed_password=get_password_hash('admin123'), nickname='管理员', role='admin', track='sales', level='expert'))
            await db.commit()
            print('Admin created: 13800000000 / admin123')
        else:
            print('Admin already exists')

asyncio.run(create_admin())
"

# 初始化场景数据
python -m scripts.seed_scenarios_full

# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8111
```

#### 步骤 3：配置前端

```bash
cd frontend

# 安装依赖
npm install

# 创建环境变量文件
echo "NEXT_PUBLIC_API_URL=/api/v1" > .env.local

# 开发模式启动
npm run dev

# 或生产模式
npm run build
npm run start
```

#### 步骤 4：验证部署

```bash
# 检查后端健康状态
curl http://localhost:8111/health

# 检查前端
curl http://localhost:3000

# 测试登录
curl -X POST http://localhost:8111/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","password":"admin123"}'
```

---

### 生产环境配置

#### 环境变量配置

生产环境请务必修改以下配置:

```bash
# 后端
APP_ENV=production
DEBUG=false
JWT_SECRET=<强随机字符串，至少32位>
DATABASE_URL=<生产数据库地址>
REDIS_URL=<生产Redis地址>
```

#### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端
    location / {
        proxy_pass http://localhost:8110;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API (通过前端代理，不需要单独配置)
    # 前端的 next.config.ts 已配置 rewrites 将 /api/* 转发到后端
}
```

#### 使用进程管理器

```bash
# 后端 - 使用 Gunicorn
pip install gunicorn
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8111

# 前端 - 使用 PM2
npm install -g pm2
pm2 start npm --name "frontend" -- start
pm2 save
pm2 startup
```

---

## 常见问题

### 1. 数据库连接失败

**问题**: `connection refused` 或 `could not connect to server`

**解决方案**:
```bash
# 检查 Docker 服务是否运行
docker ps

# 重启数据库
make db

# 检查端口占用
lsof -i :5432
```

### 2. 前端无法连接后端

**问题**: 前端请求返回 `ERR_CONNECTION_REFUSED`

**解决方案**:
- 检查后端是否启动: `curl http://localhost:8111/health`
- 检查 `NEXT_PUBLIC_API_URL` 环境变量
- 检查 CORS 配置 (开发环境应允许 `localhost:8110`)

### 3. 迁移失败

**问题**: `alembic upgrade head` 失败

**解决方案**:
```bash
# 检查数据库连接
cd backend
source .venv/bin/activate
python -c "from app.db.session import engine; print('OK')"

# 重置迁移 (危险操作！仅开发环境)
alembic downgrade base
alembic upgrade head
```

### 4. 实时语音无法连接

**问题**: WebSocket 连接失败

**解决方案**:
- 检查 `DASHSCOPE_API_KEY` 是否配置
- 检查网络是否能访问阿里云服务
- 查看后端日志: `docker-compose logs -f backend`

### 5. npm install 慢

**解决方案**: 使用国内镜像源
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

---

## 贡献指南

### 开发流程

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -m "feat: add your feature"`
4. 推送分支: `git push origin feature/your-feature`
5. 提交 Pull Request

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建工具、依赖更新
```

### 代码规范

- 后端: 遵循 PEP 8，使用 Ruff 检查
- 前端: 遵循 Airbnb JavaScript Style Guide
- 提交前必须通过: `make lint` 和 `make test`

### 文件头部模板

所有新文件必须添加以下注释:

```python
"""
开发：<你的称呼>
功能：<功能描述>
作用：<作用说明>
创建时间：<创建日期>
最后修改：<修改日期>
"""
```

---

## 路线图

### v1.0 (当前版本)

- [x] 用户认证与权限管理
- [x] 场景对练 (文字/语音)
- [x] 训练报告与评分
- [x] 仪表盘统计
- [x] 基础后台管理

---

## 技术支持

### 文档

- [项目 Wiki](docs/)
- [API 文档](http://localhost:8111/docs)
- [AGENTS.md](AGENTS.md) - AI Agent 开发指南
- [PRD 文档](PRD_销冠与社恐培养系统.md)

### 联系方式

- 开发者: Excellent
- 邮箱: 11964948@qq.com
- 问题反馈: 提交 [GitHub Issue](issues)

---

## 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 致谢

- **[Qoder社区](https://qoder.ai)** - 创意灵感的来源
- **[Qoder](https://qoder.ai)** - AI 辅助编程工具
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 Python Web 框架
- [Next.js](https://nextjs.org/) - React 生产级框架
- [阿里云百炼](https://bailian.console.aliyun.com/) - AI 模型服务
- [Lucide](https://lucide.dev/) - 优雅的图标库

---

<div align="center">

**让 AI 成为你的能力增长教练**

Made with ❤️ by Excellent

</div>
