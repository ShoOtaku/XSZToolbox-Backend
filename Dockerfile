# 多阶段构建 Dockerfile for XSZToolbox Backend

# ==================== 构建阶段 ====================
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖（包括开发依赖）
RUN npm ci

# 复制源代码
COPY . .

# ==================== 生产阶段 ====================
FROM node:18-alpine

# 安装必要的系统依赖
RUN apk add --no-cache \
    tini \
    sqlite \
    && rm -rf /var/cache/apk/*

# 创建非 root 用户
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# 设置工作目录
WORKDIR /app

# 从构建阶段复制 node_modules
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs src ./src

# 创建必要的目录
RUN mkdir -p database logs admin-panel/dist && \
    chown -R nodejs:nodejs database logs admin-panel

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "src/app.js"]
