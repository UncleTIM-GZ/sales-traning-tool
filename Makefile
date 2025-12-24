# 销冠培养系统 & 社恐培养系统 - Makefile

.PHONY: help dev backend frontend db migrate seed test lint clean

# 默认目标
help:
	@echo "销冠培养系统 & 社恐培养系统 - 开发命令"
	@echo ""
	@echo "使用方法: make [命令]"
	@echo ""
	@echo "开发命令:"
	@echo "  dev          启动完整开发环境 (数据库 + 后端 + 前端)"
	@echo "  backend      仅启动后端服务"
	@echo "  frontend     仅启动前端服务"
	@echo "  db           启动数据库服务 (PostgreSQL + Redis)"
	@echo ""
	@echo "数据库命令:"
	@echo "  migrate      运行数据库迁移"
	@echo "  migrate-new  创建新的迁移文件"
	@echo "  seed         初始化种子数据 (管理员、场景、课程等)"
	@echo ""
	@echo "测试命令:"
	@echo "  test         运行所有测试"
	@echo "  test-backend 运行后端测试"
	@echo ""
	@echo "代码质量:"
	@echo "  lint         运行代码检查"
	@echo "  format       格式化代码"
	@echo ""
	@echo "其他命令:"
	@echo "  install      安装所有依赖"
	@echo "  clean        清理临时文件"

# 启动数据库服务
db:
	docker-compose up -d postgres redis
	@echo "等待数据库启动..."
	@sleep 3
	@echo "数据库已启动"
	@echo "PostgreSQL: localhost:8108 (容器内 5432)"
	@echo "Redis: localhost:8109 (容器内 6379)"

# 启动后端服务
backend: db
	cd backend && \
	python -m venv .venv 2>/dev/null || true && \
	. .venv/bin/activate && \
	pip install -r requirements.txt && \
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8111

# 启动前端服务
frontend:
	cd frontend && npm run dev

# 启动完整开发环境
dev:
	@echo "启动开发环境..."
	@make db
	@echo "在新终端中运行: make backend"
	@echo "在新终端中运行: make frontend"

# 安装所有依赖
install:
	cd backend && \
	python -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements-dev.txt
	cd frontend && npm install

# 数据库迁移
migrate:
	cd backend && \
	. .venv/bin/activate && \
	alembic upgrade head

# 创建新迁移
migrate-new:
	@read -p "迁移描述: " desc; \
	cd backend && \
	. .venv/bin/activate && \
	alembic revision --autogenerate -m "$$desc"

# 初始化种子数据 (管理员、场景、课程等)
seed:
	@echo "初始化种子数据..."
	cd backend && \
	. .venv/bin/activate && \
	python scripts/seed_data.py && \
	python -m scripts.seed_scenarios_full && \
	python -m scripts.seed_all
	@echo "种子数据初始化完成!"

# 运行测试
test: test-backend

test-backend:
	cd backend && \
	. .venv/bin/activate && \
	pytest -v

# 代码检查
lint:
	cd backend && \
	. .venv/bin/activate && \
	ruff check app
	cd frontend && npm run lint

# 格式化代码
format:
	cd backend && \
	. .venv/bin/activate && \
	ruff format app
	cd frontend && npm run lint -- --fix

# 清理
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "清理完成"

# 停止所有服务
stop:
	docker-compose down
	@echo "所有服务已停止"
