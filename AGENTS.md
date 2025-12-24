# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## 项目概述

销冠培养系统 & 社恐培养系统 - 基于 Agent 模拟的销售和社交能力培训平台。

**技术栈:**
- 前端: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- 后端: FastAPI + Python 3.11+ + SQLAlchemy (AsyncIO) + Alembic
- 数据库: PostgreSQL + Redis
- AI: 阿里云百炼 (DashScope) - 通义千问系列模型 + Qwen-Omni 实时语音
- 状态管理: Zustand (持久化存储)
- UI 组件: Lucide React 图标库 + 自定义组件
- 任务队列: Celery (可选)

## 开发命令

### 环境启动
```bash
# 启动数据库服务 (PostgreSQL + Redis)
make db

# 启动后端开发服务器 (需要在新终端中运行)
make backend
# 或直接运行:
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8111

# 启动前端开发服务器 (需要在新终端中运行)
make frontend
# 或直接运行:
cd frontend && npm run dev
```

### 依赖安装
```bash
# 安装所有依赖 (后端 + 前端)
make install

# 仅安装后端依赖
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt

# 仅安装前端依赖
cd frontend && npm install
```

### 数据库迁移
```bash
# 运行数据库迁移
make migrate
# 或: cd backend && source .venv/bin/activate && alembic upgrade head

# 创建新迁移文件
make migrate-new
# 或: cd backend && source .venv/bin/activate && alembic revision --autogenerate -m "描述"

# 初始化种子数据 (管理员、场景、课程等)
make seed
# 或手动运行:
# cd backend && source .venv/bin/activate
# python scripts/seed_data.py          # 基础数据
# python -m scripts.seed_scenarios_full # 30个训练场景
# python -m scripts.seed_all           # 课程、挑战等
```

### 测试
```bash
# 运行所有测试
make test

# 仅运行后端测试
make test-backend
# 或: cd backend && source .venv/bin/activate && pytest -v
```

### 代码质量检查
```bash
# 运行 linter (后端 + 前端)
make lint

# 后端代码检查
cd backend && source .venv/bin/activate && ruff check app

# 前端代码检查
cd frontend && npm run lint

# 格式化代码
make format
# 后端: cd backend && source .venv/bin/activate && ruff format app
# 前端: cd frontend && npm run lint -- --fix
```

### 构建
```bash
# 前端构建
cd frontend && npm run build

# 前端生产运行
cd frontend && npm run start
```

### 清理
```bash
# 清理临时文件和缓存
make clean

# 停止所有 Docker 服务
make stop
```

## 项目架构

### 后端架构 (FastAPI)

**目录结构:**
```
backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 应用配置 (Pydantic Settings)
│   ├── api/
│   │   └── v1/              # API v1 路由
│   │       ├── __init__.py  # 路由注册
│   │       ├── auth.py      # 认证相关
│   │       ├── users.py     # 用户管理
│   │       ├── courses.py   # 课程管理
│   │       ├── scenarios.py # 场景管理
│   │       ├── sessions.py  # 训练会话
│   │       ├── realtime.py  # 实时语音对话 (WebSocket)
│   │       ├── community.py # 社区功能
│   │       ├── admin.py     # 后台管理
│   │       └── ...
│   ├── models/              # SQLAlchemy 数据库模型
│   │   ├── user.py
│   │   ├── course.py
│   │   ├── scenario.py
│   │   ├── session.py
│   │   └── ...
│   ├── schemas/             # Pydantic 数据模型 (请求/响应)
│   ├── services/            # 业务逻辑层
│   │   ├── user_service.py
│   │   ├── session_service.py
│   │   ├── scenario_service.py
│   │   ├── training_plan_service.py
│   │   └── ...
│   ├── agents/              # AI Agent 实现
│   │   ├── base.py          # Agent 基类
│   │   ├── director.py      # 导演 Agent (场景编排)
│   │   ├── npc.py           # NPC Agent (对话角色)
│   │   ├── evaluator.py     # 评估 Agent (打分反馈)
│   │   ├── coach.py         # 教练 Agent (学习建议)
│   │   ├── orchestrator.py  # Agent 协调器
│   │   ├── safety.py        # 安全检查 Agent
│   │   └── memory.py        # 记忆管理
│   ├── providers/           # 外部服务提供者
│   │   └── llm/             # LLM 提供者 (DashScope/阿里云百炼)
│   ├── core/                # 核心功能
│   │   ├── security.py      # JWT 认证
│   │   ├── middleware.py    # 中间件
│   │   └── exceptions.py    # 异常处理
│   └── db/                  # 数据库连接
├── alembic/                 # 数据库迁移文件
├── tests/                   # 测试文件
├── requirements.txt         # 生产依赖
└── requirements-dev.txt     # 开发依赖
```

**核心设计模式:**

1. **多 Agent 协作架构:**
   - Director Agent: 编排场景、控制对话流程
   - NPC Agent: 模拟对话角色 (客户、朋友等)
   - Evaluator Agent: 实时评估用户表现
   - Coach Agent: 提供学习建议和反馈
   - Safety Agent: 内容安全检查

2. **LLM 提供者抽象层:**
   - `providers/llm/base.py`: 定义统一接口
   - `providers/llm/dashscope.py`: 阿里云百炼实现
   - 支持流式输出、工具调用

3. **实时语音对话:**
   - 使用阿里云 Qwen-Omni-Realtime 模型
   - WebSocket 连接 (`api/v1/realtime.py`)
   - VAD (语音活动检测) 自动触发回复

4. **服务层设计:**
   - 所有业务逻辑封装在 `services/` 目录
   - 依赖注入通过 `api/deps.py` 管理
   - 异步数据库操作 (SQLAlchemy AsyncSession)

### 前端架构 (Next.js)

**目录结构:**
```
frontend/src/
├── app/                     # Next.js App Router
│   ├── layout.tsx           # 全局布局
│   ├── (public)/            # 公开页面 (登录、注册)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/              # 主应用 (需认证)
│   │   ├── dashboard/page.tsx
│   │   ├── courses/page.tsx
│   │   ├── community/page.tsx
│   │   └── ...
│   ├── admin/               # 后台管理
│   │   ├── layout.tsx
│   │   ├── users/page.tsx
│   │   ├── courses/page.tsx
│   │   └── ...
│   └── training/            # 训练页面
│       └── [id]/
│           ├── page.tsx     # 文字对话
│           └── voice/page.tsx # 语音对话
├── components/              # React 组件
│   ├── ui/                  # 基础 UI 组件
│   ├── admin/               # 后台管理组件
│   ├── charts/              # 图表组件 (Recharts)
│   └── ...
├── lib/
│   ├── api.ts               # API 客户端 (统一封装 fetch)
│   └── utils.ts             # 工具函数
├── stores/                  # Zustand 状态管理
│   └── authStore.ts         # 认证状态 (持久化)
├── hooks/                   # 自定义 Hooks
└── types/                   # TypeScript 类型定义
```

**核心设计:**

1. **状态管理:**
   - Zustand + persist 中间件实现认证状态持久化
   - localStorage 存储 token 和用户信息
   - `authStore.ts` 管理登录状态

2. **API 通信:**
   - 统一封装在 `lib/api.ts`
   - 自动注入 JWT token (从 localStorage 读取)
   - 错误处理和响应规范化

3. **路由分组:**
   - `(public)`: 无需认证的页面
   - `(main)`: 需要认证的主应用
   - `admin`: 后台管理 (需要 admin 权限)
   - `training`: 训练场景页面

4. **UI 组件:**
   - 使用 Lucide React 图标库 (禁止使用 emoji)
   - Tailwind CSS 4 样式方案
   - 自定义 UI 组件库 (`components/ui/`)

## 重要约定

### 文件头部规范
所有新创建的代码文件必须添加以下版权信息：
```typescript
/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：{{FUNCTION_DESCRIPTION}}
 * 作用：{{PURPOSE_DESCRIPTION}}
 * 创建时间：{{CREATION_DATE}}
 * 最后修改：{{LAST_MODIFIED}}
 */
```

### 代码风格
- **禁止使用 emoji** (UI、注释、日志等所有地方)
- **图标使用:** Lucide React 图标库
- **命名规范:**
  - 文件: `kebab-case.ts`, `PascalCase.tsx` (组件)
  - 变量/函数: `camelCase`
  - 类/组件: `PascalCase`
  - 常量: `SCREAMING_SNAKE_CASE`
- **TypeScript:** 严格模式，禁止使用 `any`，使用 `unknown` 代替

### 环境变量
- 后端配置: `backend/.env` (参考 `.env.example`)
- 前端配置: `frontend/.env.local`
- **重要:** 阿里云百炼 API Key 配置在 `DASHSCOPE_API_KEY`

### 数据库
- 使用 Alembic 进行数据库迁移
- 所有 ORM 操作使用异步 AsyncSession
- **开发环境端口 (宿主机):** PostgreSQL: 8108, Redis: 8109
- **生产环境端口 (容器内部):** PostgreSQL: 5432, Redis: 6379
- **注意:** Docker 将容器内部端口映射到宿主机，开发时连接 localhost:8108/8109

### API 设计
- RESTful 风格，使用名词复数 (`/api/v1/users`)
- 响应格式: `{"data": {...}}` (成功) 或 `{"error": {...}}` (失败)
- JWT 认证，token 有效期 24 小时

### 测试
- 测试文件与源文件同目录 (`*.test.ts` 或 `*.spec.ts`)
- 后端测试使用 pytest (异步模式)
- 提交前必须通过所有测试

## AI 模型配置

### 阿里云百炼 (DashScope)
- **默认模型:** `qwen3-max` (可选 `qwen-plus`, `qwen-turbo`)
- **实时语音模型:** `qwen3-omni-flash-realtime`
- **文档:** https://help.aliyun.com/zh/model-studio/
- **API Key 获取:** https://bailian.console.aliyun.com/#/api-key

### Agent 配置
- 所有 Agent 继承自 `BaseAgent` (定义在 `backend/app/agents/base.py`)
- Agent 上下文包含: session_id, user_id, scenario_id, mode, history
- 支持流式输出和工具调用

## 特别注意

1. **实时语音对话:** 通过 WebSocket 连接，路径为 `/api/v1/realtime/{session_id}`
2. **上传文件:** 存储在 `backend/uploads/`，通过 `/uploads/` 路径访问
3. **CORS 配置:** 开发环境允许所有来源，生产环境需配置
4. **日志:** 使用 structlog，生产环境输出 JSON 格式
5. **时区:** 所有时间使用 UTC，前端显示转换为 Asia/Shanghai (UTC+8)
