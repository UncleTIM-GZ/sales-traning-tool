# 前端Dockerfile - 生产环境
FROM node:20-alpine AS builder

WORKDIR /app

# 镜像加速参数
ARG USE_MIRROR=false
ARG NPM_MIRROR=https://mirrors.cloud.tencent.com/npm/

# 配置 Alpine APK 加速
RUN if [ "$USE_MIRROR" = "true" ]; then \
        sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories; \
    fi

# 配置 npm 加速
RUN if [ "$USE_MIRROR" = "true" ]; then \
        npm config set registry $NPM_MIRROR; \
    fi

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建时环境变量
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 设置后端URL为Docker内部网络地址（构建时嵌入到rewrites配置中）
ENV BACKEND_URL=http://backend:8111

# 构建
RUN npm run build

# 生产阶段 - 更小的镜像
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 暴露端口
EXPOSE 8110

ENV PORT=8110

# 启动命令
CMD ["node", "server.js"]
