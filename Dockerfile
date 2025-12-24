# ================================
# Build stage
# ================================
FROM node:22-alpine AS builder
WORKDIR /app

# 安装依赖所需的系统包
RUN apk add --no-cache libc6-compat

# 复制 package 文件
COPY package.json ./
COPY package-lock.json* ./

# 安装依赖（优先使用 ci，如果没有 lock 文件则使用 install）
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 复制源代码
COPY . .

# 设置环境变量启用 standalone 模式
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN npm run build

# ================================
# Production stage
# ================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制公共资源
COPY --from=builder /app/public ./public

# 设置 .next 目录权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制 standalone 构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3005

# 设置端口环境变量
ENV PORT=3005
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]

