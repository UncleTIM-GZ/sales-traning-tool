#!/bin/bash
# ================================================
# 销冠培养系统 - 一键部署脚本
# ================================================
# 使用方法: ./deploy.sh [命令]
# 命令:
#   start    - 启动服务 (默认)
#   stop     - 停止服务
#   restart  - 重启服务
#   rebuild  - 重新构建并启动
#   logs     - 查看日志
#   status   - 查看服务状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 默认镜像加速地址 (可通过 .env 覆盖)
DOCKER_MIRROR_DEFAULT="https://mirror.ccs.tencentyun.com"
PIP_MIRROR_DEFAULT="https://mirrors.cloud.tencent.com/pypi/simple"
NPM_MIRROR_DEFAULT="https://mirrors.cloud.tencent.com/npm/"
DOCKER_DAEMON_FILE="/etc/docker/daemon.json"

# 检查必要文件
check_requirements() {
    info "检查部署环境..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
    fi
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose 未安装，请先安装 Docker Compose"
    fi
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        warn ".env 文件不存在，从模板创建..."
        if [ -f ".env.production.example" ]; then
            cp .env.production.example .env
            warn "已创建 .env 文件，请修改配置后重新运行部署脚本"
            exit 1
        else
            error ".env.production.example 模板文件不存在"
        fi
    fi
    
    success "环境检查通过"
}

# 加载环境变量
load_env() {
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
}

# 配置腾讯云镜像加速
setup_tencent_mirror() {
    load_env
    
    if [ "$USE_TENCENT_MIRROR" = "true" ]; then
        # 使用 .env 中的配置或默认值
        MIRROR_URL="${DOCKER_MIRROR:-$DOCKER_MIRROR_DEFAULT}"
        
        info "配置 Docker 镜像加速: $MIRROR_URL"
        
        # 检查是否已配置
        if [ -f "$DOCKER_DAEMON_FILE" ]; then
            if grep -q "$MIRROR_URL" "$DOCKER_DAEMON_FILE"; then
                info "Docker 镜像加速已配置"
                return 0
            fi
        fi
        
        # 需要 root 权限
        if [ "$EUID" -ne 0 ]; then
            warn "配置镜像加速需要 root 权限，尝试使用 sudo..."
            SUDO="sudo"
        else
            SUDO=""
        fi
        
        # 创建或更新 daemon.json
        if [ -f "$DOCKER_DAEMON_FILE" ]; then
            # 备份原文件
            $SUDO cp "$DOCKER_DAEMON_FILE" "${DOCKER_DAEMON_FILE}.bak"
            
            # 检查是否已有 registry-mirrors
            if grep -q "registry-mirrors" "$DOCKER_DAEMON_FILE"; then
                warn "daemon.json 已有镜像配置，请手动添加: $MIRROR_URL"
            else
                # 添加镜像配置
                $SUDO tee "$DOCKER_DAEMON_FILE" > /dev/null <<EOF
{
    "registry-mirrors": ["$MIRROR_URL"]
}
EOF
            fi
        else
            # 创建新文件
            $SUDO mkdir -p /etc/docker
            $SUDO tee "$DOCKER_DAEMON_FILE" > /dev/null <<EOF
{
    "registry-mirrors": ["$MIRROR_URL"]
}
EOF
        fi
        
        # 重启 Docker
        info "重启 Docker 服务..."
        $SUDO systemctl restart docker || $SUDO service docker restart
        
        success "Docker 镜像加速配置完成"
        info "pip 加速: ${PIP_MIRROR:-$PIP_MIRROR_DEFAULT}"
        info "npm 加速: ${NPM_MIRROR:-$NPM_MIRROR_DEFAULT}"
    else
        info "未启用镜像加速 (USE_TENCENT_MIRROR=false)"
    fi
}

# Docker Compose 命令封装
docker_compose() {
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.prod.yml "$@"
    else
        docker-compose -f docker-compose.prod.yml "$@"
    fi
}

# 启动服务
start_services() {
    info "启动服务..."
    docker_compose up -d
    success "服务启动完成"
    echo ""
    show_status
}

# 停止服务
stop_services() {
    info "停止服务..."
    docker_compose down
    success "服务已停止"
}

# 重启服务
restart_services() {
    info "重启服务..."
    docker_compose restart
    success "服务已重启"
}

# 重新构建
rebuild_services() {
    info "重新构建镜像..."
    docker_compose build --no-cache
    info "启动服务..."
    docker_compose up -d
    success "重新构建并启动完成"
}

# 查看日志
show_logs() {
    docker_compose logs -f
}

# 显示服务状态
show_status() {
    info "服务状态:"
    echo ""
    docker_compose ps
    echo ""
    
    # 检查健康状态
    info "健康检查:"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8111/health | grep -q "200"; then
        success "后端服务: 正常 (http://localhost:8111)"
    else
        warn "后端服务: 异常或未启动"
    fi
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8110 | grep -q "200"; then
        success "前端服务: 正常 (http://localhost:8110)"
    else
        warn "前端服务: 异常或未启动"
    fi
}

# 运行 Alembic 数据库迁移
run_migrations() {
    info "运行数据库迁移 (Alembic)..."
    
    # 等待数据库就绪
    info "  等待数据库就绪..."
    sleep 5
    
    # 运行 Alembic 迁移
    docker_compose exec -T backend alembic upgrade head
    
    success "数据库迁移完成!"
}

# 初始化数据库
init_database() {
    info "初始化数据库..."
    
    # 运行 Alembic 迁移（自动创建所有表）
    info "  [1/5] 运行数据库迁移..."
    run_migrations
    
    # 初始化基础数据（管理员、系统配置、会员等级、成就）
    info "  [2/5] 初始化基础数据（管理员、系统配置等）..."
    docker_compose exec -T backend python scripts/seed_data.py
    
    # 初始化场景数据
    info "  [3/5] 初始化30个默认场景..."
    docker_compose exec -T backend python -m scripts.seed_scenarios_full
    
    # 初始化其他种子数据
    info "  [4/5] 初始化课程/挑战赛等数据..."
    docker_compose exec -T backend python -m scripts.seed_all
    
    # 初始化广场数据（标签、成就等）
    info "  [5/5] 初始化广场数据..."
    docker_compose exec -T backend python -m scripts.seed_plaza || true
    
    success "数据库初始化完成!"
    echo ""
    info "默认管理员账号: 13800000000 / admin123"
}

# 主菜单
main() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}    销冠培养系统 - 生产环境部署脚本${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    
    COMMAND=${1:-start}
    
    case $COMMAND in
        start)
            check_requirements
            setup_tencent_mirror
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        rebuild)
            check_requirements
            setup_tencent_mirror
            rebuild_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        init-db)
            init_database
            ;;
        upgrade)
            # 更新部署：拉取最新代码、重建镜像、运行迁移
            info "开始更新部署..."
            check_requirements
            rebuild_services
            run_migrations
            success "更新部署完成!"
            ;;
        full-deploy)
            # 完整部署（首次安装）
            info "开始完整部署..."
            check_requirements
            setup_tencent_mirror
            rebuild_services
            init_database
            success "完整部署完成!"
            echo ""
            info "访问地址: http://localhost:8110"
            info "默认管理员: 13800000000 / admin123"
            ;;
        mirror)
            setup_tencent_mirror
            ;;
        migrate)
            # 仅运行数据库迁移
            info "运行数据库迁移..."
            run_migrations
            ;;
        *)
            echo "用法: $0 {start|stop|restart|rebuild|logs|status|init-db|upgrade|full-deploy|migrate|mirror}"
            echo ""
            echo "命令说明:"
            echo "  start        - 启动服务 (默认)"
            echo "  stop         - 停止服务"
            echo "  restart      - 重启服务"
            echo "  rebuild      - 重新构建并启动"
            echo "  logs         - 查看日志"
            echo "  status       - 查看服务状态"
            echo "  init-db      - 初始化数据库（首次部署）"
            echo "  upgrade      - 更新部署（拉取更新后使用）"
            echo "  full-deploy  - 完整部署（首次安装一键完成）"
            echo "  migrate      - 仅运行数据库迁移"
            echo "  mirror       - 仅配置镜像加速"
            exit 1
            ;;
    esac
}

main "$@"

