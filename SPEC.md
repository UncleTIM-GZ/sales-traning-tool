# 销冠与社恐培养系统 - 技术规格文档

## 项目信息

- **项目名称**: Agentic Simulation Platform (ASP)
- **版本**: MVP v1.0
- **基于PRD版本**: V2.0 (2025-12-22)

---

## 技术栈

### 后端 (Python)
| 组件 | 技术选型 | 版本 |
|------|----------|------|
| Web框架 | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0+ |
| 数据库迁移 | Alembic | 1.13+ |
| 任务队列 | Celery + Redis | 5.3+ |
| 验证 | Pydantic | 2.0+ |
| 测试 | pytest + pytest-asyncio | 8.0+ |

### 前端 (TypeScript)
| 组件 | 技术选型 | 版本 |
|------|----------|------|
| 框架 | Next.js (App Router) | 15+ |
| UI组件库 | Shadcn/UI + Tailwind CSS | - |
| 状态管理 | Zustand | 5+ |
| HTTP客户端 | TanStack Query | 5+ |
| 表单 | React Hook Form + Zod | - |

### 数据层
| 组件 | 技术选型 | 用途 |
|------|----------|------|
| 关系型数据库 | PostgreSQL | 业务数据 |
| 缓存/队列 | Redis | Session缓存/任务队列 |
| 向量数据库 | pgvector | 记忆检索/RAG |

### AI/语音服务
| 组件 | Provider | 用途 |
|------|----------|------|
| LLM | OpenAI GPT-4o | Agent对话 |
| 实时语音 | OpenAI Realtime API | 语音对练 |
| 备选语音 | 豆包端到端语音 | 国内语音 |
| ASR备选 | 阿里云/腾讯云 | 级联模式 |

---

## 项目结构

```
xiaoshou/
├── backend/                    # FastAPI后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # 应用入口
│   │   ├── config.py          # 配置管理
│   │   ├── api/               # API路由
│   │   │   ├── __init__.py
│   │   │   ├── deps.py        # 依赖注入
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py    # 认证相关
│   │   │   │   ├── users.py   # 用户管理
│   │   │   │   ├── scenarios.py  # 场景管理
│   │   │   │   ├── sessions.py   # 会话管理
│   │   │   │   ├── training.py   # 训练计划
│   │   │   │   └── reports.py    # 报告管理
│   │   ├── core/              # 核心功能
│   │   │   ├── __init__.py
│   │   │   ├── security.py    # JWT/密码加密
│   │   │   ├── exceptions.py  # 自定义异常
│   │   │   └── middleware.py  # 中间件
│   │   ├── db/                # 数据库
│   │   │   ├── __init__.py
│   │   │   ├── session.py     # 数据库会话
│   │   │   └── base.py        # Base模型
│   │   ├── models/            # SQLAlchemy模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── profile.py
│   │   │   ├── scenario.py
│   │   │   ├── session.py
│   │   │   ├── report.py
│   │   │   └── training_plan.py
│   │   ├── schemas/           # Pydantic模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── scenario.py
│   │   │   ├── session.py
│   │   │   └── report.py
│   │   ├── services/          # 业务逻辑
│   │   │   ├── __init__.py
│   │   │   ├── user_service.py
│   │   │   ├── scenario_service.py
│   │   │   └── training_service.py
│   │   ├── agents/            # Agent系统
│   │   │   ├── __init__.py
│   │   │   ├── base.py        # Agent基类
│   │   │   ├── director.py    # 导演Agent
│   │   │   ├── npc.py         # NPC Agent
│   │   │   ├── evaluator.py   # 评估Agent
│   │   │   ├── coach.py       # 教练Agent
│   │   │   ├── safety.py      # 安全Agent
│   │   │   ├── memory.py      # 记忆Agent
│   │   │   └── orchestrator.py # Agent编排器
│   │   ├── providers/         # 外部服务提供者
│   │   │   ├── __init__.py
│   │   │   ├── llm/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py    # LLM抽象
│   │   │   │   └── openai.py
│   │   │   ├── voice/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py    # 语音抽象
│   │   │   │   ├── openai_realtime.py
│   │   │   │   └── doubao.py
│   │   │   └── asr/
│   │   │       ├── __init__.py
│   │   │       └── base.py
│   │   └── workers/           # Celery任务
│   │       ├── __init__.py
│   │       ├── celery_app.py
│   │       └── tasks.py
│   ├── alembic/               # 数据库迁移
│   │   ├── versions/
│   │   ├── env.py
│   │   └── alembic.ini
│   ├── tests/                 # 测试
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_api/
│   │   └── test_agents/
│   ├── scripts/               # 脚本
│   │   └── seed_scenarios.py  # 场景种子数据
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── pyproject.toml
│
├── frontend/                   # Next.js前端
│   ├── src/
│   │   ├── app/               # App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── (auth)/        # 认证页面组
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (main)/        # 主应用页面组
│   │   │   │   ├── dashboard/
│   │   │   │   ├── training/
│   │   │   │   ├── practice/
│   │   │   │   └── profile/
│   │   │   └── admin/         # 管理后台
│   │   │       ├── scenarios/
│   │   │       └── rubrics/
│   │   ├── components/        # 组件
│   │   │   ├── ui/            # 基础UI组件
│   │   │   ├── practice/      # 对练组件
│   │   │   ├── report/        # 报告组件
│   │   │   └── charts/        # 图表组件
│   │   ├── lib/               # 工具库
│   │   │   ├── api.ts         # API客户端
│   │   │   ├── auth.ts        # 认证工具
│   │   │   └── utils.ts
│   │   ├── hooks/             # 自定义Hooks
│   │   │   ├── useSession.ts
│   │   │   └── useVoice.ts
│   │   ├── stores/            # Zustand状态
│   │   │   ├── authStore.ts
│   │   │   └── sessionStore.ts
│   │   └── types/             # TypeScript类型
│   │       └── index.ts
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.ts
│
├── docker/                     # Docker配置
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml          # 开发环境
├── docker-compose.prod.yml     # 生产环境
├── .env.example                # 环境变量模板
├── .gitignore
├── PRD_销冠与社恐培养系统.md
├── SPEC.md
└── Makefile                    # 常用命令
```

---

## 数据库设计

### 核心表结构

#### users (用户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| email | VARCHAR(255) | 邮箱(唯一) |
| hashed_password | VARCHAR(255) | 加密密码 |
| name | VARCHAR(100) | 姓名 |
| track | ENUM | 赛道: sales/social |
| role | ENUM | 角色: user/admin |
| org_id | UUID | 组织ID (可选) |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### profiles (用户画像)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID (外键) |
| baseline_score | FLOAT | 基线分 |
| weak_dimensions | JSONB | 短板维度 |
| preferences | JSONB | 偏好设置 |
| onboarding_completed | BOOLEAN | 是否完成入门 |
| created_at | TIMESTAMP | 创建时间 |

#### scenarios (场景表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| pack_id | UUID | 场景包ID |
| name | VARCHAR(100) | 场景名称 |
| track | ENUM | 赛道: sales/social |
| mode | ENUM | 模式: train/exam/replay |
| difficulty | INTEGER | 难度(1-5) |
| config | JSONB | 场景配置 |
| rubric_version | VARCHAR(50) | 评分标准版本 |
| version | VARCHAR(20) | 场景版本 |
| status | ENUM | 状态: draft/published/archived |
| created_at | TIMESTAMP | 创建时间 |

#### sessions (会话表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| scenario_id | UUID | 场景ID |
| mode | ENUM | train/exam/replay |
| seed | INTEGER | 随机种子(Exam) |
| status | ENUM | pending/active/completed/aborted |
| started_at | TIMESTAMP | 开始时间 |
| ended_at | TIMESTAMP | 结束时间 |
| metadata | JSONB | 元数据 |

#### session_turns (对话轮次)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| session_id | UUID | 会话ID |
| turn_number | INTEGER | 轮次序号 |
| role | ENUM | user/npc/coach |
| content | TEXT | 对话内容 |
| audio_url | VARCHAR(500) | 音频URL(可选) |
| partial_score | JSONB | 过程评分 |
| created_at | TIMESTAMP | 创建时间 |

#### reports (评分报告)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| session_id | UUID | 会话ID |
| user_id | UUID | 用户ID |
| total_score | FLOAT | 总分 |
| dimensions | JSONB | 维度分数 |
| highlights | JSONB | 亮点 |
| issues | JSONB | 问题点 |
| replacements | JSONB | 改写建议 |
| next_actions | JSONB | 下一步建议 |
| rubric_version | VARCHAR(50) | 评分标准版本 |
| created_at | TIMESTAMP | 创建时间 |

#### training_plans (训练计划)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| name | VARCHAR(100) | 计划名称 |
| duration_days | INTEGER | 天数 |
| daily_tasks | JSONB | 每日任务 |
| status | ENUM | active/paused/completed |
| started_at | TIMESTAMP | 开始时间 |
| created_at | TIMESTAMP | 创建时间 |

#### rubrics (评分标准)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| version | VARCHAR(50) | 版本号 |
| track | ENUM | sales/social |
| dimensions | JSONB | 评分维度 |
| status | ENUM | active/deprecated |
| created_at | TIMESTAMP | 创建时间 |

---

## API设计

### 认证 API
```
POST   /api/v1/auth/register     # 用户注册
POST   /api/v1/auth/login        # 用户登录
POST   /api/v1/auth/refresh      # 刷新Token
POST   /api/v1/auth/logout       # 用户登出
```

### 用户 API
```
GET    /api/v1/users/me          # 获取当前用户
PUT    /api/v1/users/me          # 更新用户信息
GET    /api/v1/users/me/profile  # 获取用户画像
PUT    /api/v1/users/me/profile  # 更新用户画像
```

### 场景 API
```
GET    /api/v1/scenarios                  # 场景列表
GET    /api/v1/scenarios/{id}             # 场景详情
POST   /api/v1/scenarios                  # 创建场景(管理员)
PUT    /api/v1/scenarios/{id}             # 更新场景(管理员)
GET    /api/v1/scenarios/packs            # 场景包列表
```

### 会话 API
```
POST   /api/v1/sessions                   # 创建会话
GET    /api/v1/sessions/{id}              # 获取会话详情
POST   /api/v1/sessions/{id}/message      # 发送消息(SSE)
POST   /api/v1/sessions/{id}/pause        # 暂停(Train)
POST   /api/v1/sessions/{id}/resume       # 恢复(Train)
POST   /api/v1/sessions/{id}/end          # 结束会话
GET    /api/v1/sessions/{id}/history      # 历史对话
```

### 语音 API
```
POST   /api/v1/voice/connect              # 建立语音连接
WS     /api/v1/voice/ws/{session_id}      # WebSocket语音流
```

### 报告 API
```
GET    /api/v1/reports                    # 报告列表
GET    /api/v1/reports/{id}               # 报告详情
GET    /api/v1/reports/compare            # Before/After对比
```

### 训练计划 API
```
GET    /api/v1/training/plans             # 计划列表
POST   /api/v1/training/plans             # 创建计划
GET    /api/v1/training/plans/{id}        # 计划详情
PUT    /api/v1/training/plans/{id}        # 更新计划
GET    /api/v1/training/progress          # 训练进度
```

---

## Agent系统设计

### Agent接口定义

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseAgent(ABC):
    """Agent基类"""
    
    @abstractmethod
    async def process(
        self, 
        context: Dict[str, Any],
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """处理输入，返回结果"""
        pass

    @abstractmethod
    async def get_state(self) -> Dict[str, Any]:
        """获取当前状态"""
        pass
```

### Agent职责矩阵

| Agent | 输入 | 输出 | 激活条件 |
|-------|------|------|----------|
| Director | 场景配置, 对话历史 | 注入事件, 难度调整 | 每轮 |
| NPC | 用户消息, Director指令 | 角色回应 | 每轮 |
| Evaluator | 对话内容 | 评分, 证据 | 每轮(实时)+结束(最终) |
| Coach | 对话内容 | 提示建议 | Train模式 |
| Safety | 对话内容 | 风险标识 | SCC模式 |
| Memory | 用户ID | 历史记忆 | 按需检索 |

---

## 开发规范

### 后端规范
- 使用async/await进行异步编程
- API响应统一使用标准格式
- 错误处理使用自定义异常
- 日志使用structlog

### 前端规范
- 组件使用函数式组件 + Hooks
- 样式使用Tailwind CSS
- API请求使用TanStack Query
- 表单使用React Hook Form

### Git规范
- 分支: main/develop/feature/*/fix/*
- Commit: type(scope): message
- PR需要Code Review

---

## 环境变量

```env
# 应用
APP_NAME=agentic-simulation
APP_ENV=development
DEBUG=true

# 数据库 (端口统一: PostgreSQL 8108, Redis 8109)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:8108/asp_db

# Redis
REDIS_URL=redis://localhost:8109/0

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o

# 语音服务(可选)
DOUBAO_API_KEY=xxx
ALIYUN_ASR_KEY=xxx
```

---

## 启动命令

```bash
# 开发环境启动
make dev

# 仅启动后端
make backend

# 仅启动前端
make frontend

# 数据库迁移
make migrate

# 运行测试
make test
```
