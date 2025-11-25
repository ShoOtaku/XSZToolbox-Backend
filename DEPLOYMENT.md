# XSZToolbox 后端部署指南

本文档详细说明如何将 XSZToolbox 后端服务部署到云平台（阿里云/腾讯云）。

---

## 📋 部署前准备

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04 LTS 或更高版本
- **CPU**: 2核心或以上
- **内存**: 2GB 或以上
- **存储**: 20GB 或以上
- **网络**: 公网 IP + 域名（推荐）

### 2. 软件环境

- Docker 20.10+
- Docker Compose 2.0+
- Git
- (可选) Node.js 18+ (用于本地开发)

---

## 🚀 部署方式

提供两种部署方式：

1. **Docker Compose 部署** (推荐)
2. **直接部署** (Node.js)

---

## 方式一：Docker Compose 部署 (推荐)

### 步骤 1: 连接服务器

```bash
# SSH 连接到服务器
ssh root@your-server-ip
```

### 步骤 2: 安装 Docker 和 Docker Compose

```bash
# 更新软件包列表
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 步骤 3: 克隆项目

```bash
# 创建项目目录
mkdir -p /opt/xsztoolbox
cd /opt/xsztoolbox

# 克隆代码（替换为您的仓库地址）
git clone https://github.com/your-username/XSZToolbox.git
cd XSZToolbox/XSZToolbox-Backend
```

### 步骤 4: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**必须修改的配置**:

```bash
# JWT 密钥（使用强随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# HMAC 签名密钥
HMAC_SECRET=your-hmac-secret-key-change-this

# 管理员 CID 哈希列表（逗号分隔）
ADMIN_CID_HASHES=A7F3C9E2D4B1F8A6EXAMPLE1,B8G4D0F3E5C2G9B7EXAMPLE2

# 生产环境必须启用 HTTPS 强制
REQUIRE_HTTPS=true

# 速率限制
ENABLE_RATE_LIMIT=true
MAX_REQUESTS_PER_MINUTE=60
```

### 步骤 5: 初始化数据库

```bash
# 创建数据库目录
mkdir -p database

# 运行数据库初始化（第一次部署时）
docker-compose run --rm xsztoolbox-backend npm run init-db
```

### 步骤 6: 启动服务

```bash
# 后台启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 验证服务状态
docker-compose ps
```

### 步骤 7: 配置防火墙

```bash
# 允许 HTTP/HTTPS 流量
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # 如果需要直接访问后端

# 启用防火墙
ufw enable
```

---

## 方式二：直接部署 (Node.js)

### 步骤 1-3: 与 Docker 部署相同

### 步骤 4: 安装 Node.js

```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 步骤 5: 安装依赖

```bash
cd /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend
npm install --production
```

### 步骤 6: 配置环境变量

```bash
cp .env.example .env
nano .env
# 参考 Docker 部署步骤 4
```

### 步骤 7: 初始化数据库

```bash
npm run init-db
```

### 步骤 8: 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start src/app.js --name xsztoolbox-backend

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs xsztoolbox-backend

# 其他命令
pm2 status        # 查看状态
pm2 restart all   # 重启
pm2 stop all      # 停止
```

---

## 🔒 配置 HTTPS (Let's Encrypt)

### 方式 A: 使用 Nginx (推荐)

#### 1. 安装 Nginx 和 Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

#### 2. 配置 Nginx

```bash
# 复制配置模板
cp nginx/nginx.conf.example nginx/nginx.conf

# 编辑配置（修改域名）
nano nginx/nginx.conf

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

#### 3. 获取 SSL 证书

```bash
# 自动获取并配置证书
certbot --nginx -d your-domain.com

# 设置自动续期
certbot renew --dry-run
```

### 方式 B: 使用 Docker Compose + Nginx

#### 1. 准备 Nginx 配置

```bash
# 创建 SSL 目录
mkdir -p nginx/ssl

# 复制配置文件
cp nginx/nginx.conf.example nginx/nginx.conf
nano nginx/nginx.conf  # 修改域名
```

#### 2. 获取证书 (Certbot)

```bash
# 安装 Certbot
apt install -y certbot

# 获取证书（需要先停止 Nginx 容器）
docker-compose down
certbot certonly --standalone -d your-domain.com

# 复制证书到 nginx/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

#### 3. 启动带 Nginx 的服务

```bash
docker-compose --profile with-nginx up -d
```

---

## 📊 监控和维护

### 查看日志

```bash
# Docker 部署
docker-compose logs -f xsztoolbox-backend

# 直接部署
pm2 logs xsztoolbox-backend

# 日志文件位置
tail -f logs/combined-YYYY-MM-DD.log
tail -f logs/error-YYYY-MM-DD.log
```

### 数据库备份

```bash
# 创建备份目录
mkdir -p /opt/backups

# 备份数据库
cp database/xsztoolbox.db /opt/backups/xsztoolbox-$(date +%Y%m%d-%H%M%S).db

# 定时备份（添加到 crontab）
crontab -e

# 每天凌晨 2 点备份
0 2 * * * cp /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend/database/xsztoolbox.db /opt/backups/xsztoolbox-$(date +\%Y\%m\%d).db && find /opt/backups -name "xsztoolbox-*.db" -mtime +7 -delete
```

### 更新部署

```bash
# Docker 部署
cd /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend
git pull
docker-compose build
docker-compose up -d

# 直接部署
cd /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend
git pull
npm install --production
pm2 restart xsztoolbox-backend
```

---

## 🔍 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 2. 数据库锁定

```bash
# SQLite 数据库锁定时重启服务
docker-compose restart  # Docker 部署
pm2 restart xsztoolbox-backend  # 直接部署
```

### 3. HTTPS 证书过期

```bash
# 手动续期
certbot renew

# 重启 Nginx
systemctl restart nginx  # 或 docker-compose restart nginx
```

### 4. 内存不足

```bash
# 查看内存使用
free -h
docker stats  # Docker 部署

# 重启服务释放内存
docker-compose restart
```

---

## 🔧 性能优化

### 1. SQLite 优化

编辑 `.env`:

```bash
# 启用 WAL 模式（已默认启用）
# 数据库连接管理器中已配置
```

### 2. 启用 Gzip 压缩

Nginx 配置中已包含 Gzip 压缩配置。

### 3. 配置缓存头

在 Nginx 配置中添加:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 📈 监控告警

### 使用 Uptime Kuma

```bash
# 使用 Docker 部署 Uptime Kuma
docker run -d --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --restart=always \
  louislam/uptime-kuma:1
```

访问 `http://your-server-ip:3001` 配置监控。

---

## 🛡️ 安全加固

### 1. 修改 SSH 端口

```bash
nano /etc/ssh/sshd_config
# Port 22 改为 Port 2222
systemctl restart sshd
```

### 2. 禁用 Root 登录

```bash
nano /etc/ssh/sshd_config
# PermitRootLogin yes 改为 PermitRootLogin no
systemctl restart sshd
```

### 3. 安装 Fail2Ban

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

## 📞 技术支持

如有问题，请提交 GitHub Issue 或联系维护者。

---

**部署完成后，请测试以下功能**:

- ✅ 访问 `https://your-domain.com/api/health` 检查服务状态
- ✅ 测试用户数据提交 API
- ✅ 测试在线验证 API
- ✅ 管理员登录和白名单管理

**祝部署顺利！** 🎉
