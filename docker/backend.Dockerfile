# 后端Dockerfile - 生产环境
FROM python:3.11-slim

WORKDIR /app

# 镜像加速参数
ARG USE_MIRROR=false
ARG PIP_MIRROR=https://mirrors.cloud.tencent.com/pypi/simple

# 配置 APT 加速 (腾讯云)
RUN if [ "$USE_MIRROR" = "true" ]; then \
        sed -i 's/deb.debian.org/mirrors.cloud.tencent.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
        sed -i 's/deb.debian.org/mirrors.cloud.tencent.com/g' /etc/apt/sources.list 2>/dev/null || true; \
    fi

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 配置 pip 加速
RUN if [ "$USE_MIRROR" = "true" ]; then \
        pip config set global.index-url $PIP_MIRROR && \
        pip config set global.trusted-host mirrors.cloud.tencent.com; \
    fi

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建上传目录
RUN mkdir -p /app/uploads

# 暴露端口
EXPOSE 8111

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8111/health || exit 1

# 启动脚本已在 COPY . . 时复制，设置执行权限
RUN chmod +x /app/docker-entrypoint.sh

# 启动命令 - 使用启动脚本自动运行迁移
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8111", "--workers", "4"]
