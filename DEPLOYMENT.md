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
# JWT 密钥（使用强随机字符串，至少 32 个字符）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 初始管理员账号配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me_immediately  # ⚠️ 部署后立即修改！

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

⚠️ **安全警告**：
- `ADMIN_PASSWORD` 仅用于初始化默认管理员账号
- 部署完成后，**必须立即**通过管理面板修改密码
- 使用强密码（至少 12 个字符，包含大小写字母、数字和特殊字符）

### 步骤 5: 初始化数据库

```bash
# 创建数据库目录
mkdir -p database

# 运行数据库初始化（第一次部署时）
docker-compose run --rm xsztoolbox-backend npm run init-db
```

这将创建数据库并使用 `.env` 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 创建默认管理员账号。

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

### 步骤 8: ⚠️ 修改默认管理员密码（重要！）

1. 访问管理面板：`https://your-domain.com/admin/`
2. 使用 `.env` 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录
3. **立即**前往"账号设置"页面
4. 修改密码为强密码（至少 12 个字符）
5. 重新登录验证新密码

⚠️ **不修改默认密码将导致严重的安全风险！**

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

### 步骤 9: ⚠️ 修改默认管理员密码

参考 Docker 部署步骤 8。

---

## 🔒 配置 HTTPS (Let's Encrypt)

⚠️ **生产环境必须启用 HTTPS**

系统配置了 `REQUIRE_HTTPS=true` 时，将强制所有请求使用 HTTPS 协议。未配置 HTTPS 将导致服务无法正常访问。

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

## 👥 用户管理系统

系统支持完整的用户管理功能，包括两种用户角色：

### 用户角色

- **管理员 (admin)**: 
  - 拥有完整权限
  - 可以管理白名单、用户、查看所有数据
  - 可以创建和管理其他用户
  - 可以修改自己的账号信息

- **普通用户 (viewer)**: 
  - 只读权限
  - 仅能查看房间列表和房间成员信息
  - 无法进行任何修改操作
  - 可以修改自己的账号信息

### 首次登录流程

1. 访问管理面板：`https://your-domain.com/admin/`
2. 使用初始管理员账号登录（`.env` 中配置的用户名和密码）
3. **立即前往"账号设置"修改密码**
4. 建议修改用户名（可选）

### 创建新用户

1. 以管理员身份登录
2. 进入"用户管理"页面
3. 点击"创建用户"按钮
4. 填写以下信息：
   - 用户名（唯一）
   - 密码（至少 8 个字符）
   - 角色（管理员/普通用户）
5. 保存后，新用户即可使用创建的凭证登录

### 用户管理操作

管理员可以执行以下操作：

- 查看所有用户列表
- 创建新用户
- 修改用户信息（用户名、角色、密码）
- 删除用户（不能删除自己）
- 查看用户登录历史

所有用户管理操作都会记录在审计日志中。

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

### 日志监控建议

⚠️ **建议定期监控以下日志，及时发现安全问题**：

#### 1. 登录失败监控

```bash
# 查看最近的登录失败
tail -f logs/combined-*.log | grep "登录失败"

# 统计登录失败次数
grep "登录失败" logs/combined-*.log | wc -l

# 查看特定用户的登录失败
grep "登录失败.*username" logs/combined-*.log
```

**异常情况**：
- 短时间内大量登录失败 → 可能是暴力破解攻击
- 同一 IP 多次失败 → 可能是恶意尝试
- 不存在的用户名频繁尝试 → 可能是扫描攻击

#### 2. 权限拒绝监控

```bash
# 查看权限拒绝日志
tail -f logs/combined-*.log | grep "权限不足"

# 统计权限拒绝次数
grep "权限不足" logs/combined-*.log | wc -l
```

**异常情况**：
- viewer 用户频繁尝试访问管理功能 → 可能是权限提升尝试
- 大量 403 错误 → 可能是未授权访问尝试

#### 3. 用户管理操作监控

```bash
# 查看用户创建日志
grep "创建用户" logs/combined-*.log

# 查看用户删除日志
grep "删除用户" logs/combined-*.log

# 查看密码修改日志
grep "修改密码" logs/combined-*.log
```

**异常情况**：
- 非工作时间的用户管理操作 → 可能是未授权操作
- 大量用户创建/删除 → 可能是账号被盗用

#### 4. 设置日志告警

使用 `logwatch` 或自定义脚本监控日志：

```bash
# 安装 logwatch
apt install -y logwatch

# 配置每日日志摘要邮件
# 编辑 /etc/logwatch/conf/logwatch.conf
```

或使用简单的监控脚本：

```bash
# 创建监控脚本
cat > /opt/xsztoolbox/monitor-logs.sh << 'SCRIPT'
#!/bin/bash
LOG_DIR="/opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend/logs"
ALERT_EMAIL="admin@example.com"

# 检查最近 1 小时的登录失败次数
FAILED_LOGINS=$(grep "登录失败" $LOG_DIR/combined-$(date +%Y-%m-%d).log | grep "$(date +%Y-%m-%d\ %H)" | wc -l)

if [ $FAILED_LOGINS -gt 10 ]; then
    echo "警告：最近 1 小时内有 $FAILED_LOGINS 次登录失败" | mail -s "XSZToolbox 安全告警" $ALERT_EMAIL
fi
SCRIPT

chmod +x /opt/xsztoolbox/monitor-logs.sh

# 添加到 crontab（每小时执行）
crontab -e
# 0 * * * * /opt/xsztoolbox/monitor-logs.sh
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

# 备份数据库（重要！）
cp database/xsztoolbox.db database/xsztoolbox.db.backup.$(date +%Y%m%d_%H%M%S)

# 拉取最新代码
git pull

# 运行数据库迁移（如有）
docker-compose run --rm xsztoolbox-backend node src/scripts/migrate-user-management.js

# 重新构建并启动
docker-compose build
docker-compose up -d

# 直接部署
cd /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend
cp database/xsztoolbox.db database/xsztoolbox.db.backup.$(date +%Y%m%d_%H%M%S)
git pull
npm install --production
node src/scripts/migrate-user-management.js  # 如有迁移
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

### 5. 忘记管理员密码

```bash
# 方法 1: 通过数据库重置密码
cd /opt/xsztoolbox/XSZToolbox/XSZToolbox-Backend

# 生成新密码哈希（使用 Node.js）
node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('new_password', 10));"

# 更新数据库
sqlite3 database/xsztoolbox.db "UPDATE admins SET password_hash='<生成的哈希>' WHERE username='admin';"

# 方法 2: 重新初始化数据库（会丢失所有数据！）
# 备份数据库
cp database/xsztoolbox.db database/xsztoolbox.db.backup
# 删除并重新初始化
rm database/xsztoolbox.db
npm run init-db
```

### 6. 登录失败次数过多被锁定

系统会在 15 分钟内连续 5 次登录失败后锁定账号 15 分钟。

```bash
# 手动清除登录失败记录
sqlite3 database/xsztoolbox.db "DELETE FROM login_attempts WHERE username='your_username';"
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

### 4. 定期安全检查清单

- [ ] 所有管理员账号使用强密码
- [ ] 定期审查用户列表，删除不需要的账号
- [ ] 定期审查审计日志，发现异常行为
- [ ] 定期更新系统和依赖包
- [ ] 定期备份数据库
- [ ] 监控登录失败和权限拒绝日志
- [ ] 确保 HTTPS 证书有效
- [ ] 确保防火墙规则正确

---

## 📞 技术支持

如有问题，请提交 GitHub Issue 或联系维护者。

---

## ✅ 部署检查清单

**部署完成后，请按顺序检查以下项目**:

### 基础功能
- [ ] 访问 `https://your-domain.com/api/health` 检查服务状态
- [ ] 测试用户数据提交 API
- [ ] 测试在线验证 API

### 用户管理
- [ ] 使用默认管理员账号登录管理面板
- [ ] **立即修改默认管理员密码**
- [ ] 测试创建新用户（管理员和普通用户）
- [ ] 测试普通用户登录和权限限制
- [ ] 测试用户信息修改
- [ ] 测试用户删除功能

### 安全检查
- [ ] 确认 HTTPS 已启用且证书有效
- [ ] 确认 `REQUIRE_HTTPS=true` 已配置
- [ ] 测试登录失败锁定功能（5 次失败后锁定）
- [ ] 检查审计日志是否正常记录
- [ ] 确认防火墙规则正确

### 监控和备份
- [ ] 配置数据库自动备份
- [ ] 配置日志监控告警
- [ ] 测试日志查看功能

**祝部署顺利！** 🎉
