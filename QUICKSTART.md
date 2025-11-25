# XSZToolbox 后端快速开始指南

## 🚀 5 分钟快速启动

### 步骤 1: 安装依赖

```bash
cd XSZToolbox-Backend
npm install
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，**必须修改**以下配置：

```bash
# 🔑 JWT 密钥（请使用强随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 🔐 管理员 CID 哈希（您的 CID 哈希，多个用逗号分隔）
ADMIN_CID_HASHES=YOUR_CID_HASH_HERE

# ⚙️ 其他配置保持默认即可
```

### 步骤 3: 初始化数据库

```bash
npm run init-db
```

成功后会看到：
```
✅ 数据库连接: ./database/xsztoolbox.db
✅ 数据库表结构已初始化
✅ 已初始化 1 个管理员账户
```

### 步骤 4: 启动服务

```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm start
```

成功启动后会看到：

```
========================================
  XSZToolbox 后端服务已启动
========================================
  端口: 3000
  环境: development
  HTTPS 强制: ❌ 关闭
  速率限制: ✅ 开启
========================================
  访问地址: http://localhost:3000
  API 文档: http://localhost:3000/api
  管理面板: http://localhost:3000/admin
========================================
```

### 步骤 5: 访问管理面板

打开浏览器访问: **http://localhost:3000/admin**

使用您的 CID 哈希登录。

---

## 📝 获取 CID 哈希的方法

### 方法 1: 使用 Node.js 计算

创建文件 `calculate-hash.js`:

```javascript
const crypto = require('crypto');

function computeCIDHash(contentId) {
    const salt = 'XSZToolbox_CID_Salt_2025';
    const input = `${salt}${contentId}`;
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex').toUpperCase();
}

// 替换为您的 CID
const yourCID = '18014449511126809';  // 示例 CID
console.log('CID 哈希:', computeCIDHash(yourCID));
```

运行：
```bash
node calculate-hash.js
```

### 方法 2: 使用在线工具

1. 访问 SHA256 在线工具: https://emn178.github.io/online-tools/sha256.html
2. 输入: `XSZToolbox_CID_Salt_2025` + 您的 CID（连在一起，无空格）
   - 例如: `XSZToolbox_CID_Salt_202518014449511126809`
3. 点击 Hash 按钮
4. 将结果转换为大写（可用文本编辑器）

### 方法 3: 使用浏览器控制台

打开浏览器控制台（F12），粘贴以下代码：

```javascript
async function computeCIDHash(cid) {
    const salt = 'XSZToolbox_CID_Salt_2025';
    const input = salt + cid;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.toUpperCase();
}

// 使用示例
computeCIDHash('18014449511126809').then(hash => console.log('CID 哈希:', hash));
```

---

## 🧪 测试 API

### 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2025-01-14T12:00:00.000Z",
  "uptime": 123.456
}
```

### 2. 提交用户数据（模拟插件）

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "cid": "YOUR_CID_HASH",
    "characterName": "测试角色",
    "worldName": "紫水栈桥",
    "qqInfo": ""
  }'
```

### 3. 验证用户授权

```bash
curl http://localhost:3000/api/verify/YOUR_CID_HASH
```

### 4. 管理员登录

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"cid_hash": "YOUR_ADMIN_CID_HASH"}'
```

响应（成功）：
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": "24h",
  "role": "admin"
}
```

### 5. 获取统计数据（需要 Token）

```bash
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🐳 使用 Docker 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
nano .env  # 修改必要配置

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down
```

### 方式二：仅 Docker

```bash
# 1. 构建镜像
docker build -t xsztoolbox-backend .

# 2. 运行容器
docker run -d \
  --name xsztoolbox-backend \
  -p 3000:3000 \
  -v $(pwd)/database:/app/database \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  xsztoolbox-backend

# 3. 查看日志
docker logs -f xsztoolbox-backend

# 4. 停止容器
docker stop xsztoolbox-backend
docker rm xsztoolbox-backend
```

---

## 📂 项目文件结构

```
XSZToolbox-Backend/
├── src/
│   ├── app.js                  # Express 主入口
│   ├── controllers/            # API 控制器
│   │   ├── userController.js   # 用户相关 API
│   │   └── adminController.js  # 管理员 API
│   ├── models/                 # 数据模型
│   │   ├── database.js         # 数据库连接管理
│   │   ├── userModel.js        # 用户数据模型
│   │   ├── whitelistModel.js   # 白名单模型
│   │   ├── auditLogModel.js    # 审计日志模型
│   │   └── adminModel.js       # 管理员模型
│   ├── middleware/             # 中间件
│   │   ├── security.js         # 安全中间件
│   │   ├── rateLimit.js        # 速率限制
│   │   ├── auth.js             # JWT 认证
│   │   └── audit.js            # 审计日志
│   ├── routes/                 # 路由定义
│   │   ├── api.js              # 公共 API 路由
│   │   └── admin.js            # 管理员 API 路由
│   ├── utils/                  # 工具函数
│   │   ├── crypto.js           # 加密工具
│   │   └── logger.js           # 日志工具
│   └── scripts/                # 脚本
│       └── initDatabase.js     # 数据库初始化
├── database/                   # SQLite 数据库文件
├── logs/                       # 日志文件
├── admin-panel/                # Web 管理面板
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js              # 主应用逻辑
│       ├── api.js              # API 调用
│       └── auth.js             # 认证管理
├── nginx/                      # Nginx 配置
├── .env.example                # 环境变量模板
├── package.json                # 依赖配置
├── Dockerfile                  # Docker 镜像
├── docker-compose.yml          # Docker Compose 配置
├── README.md                   # 项目说明
├── DEPLOYMENT.md               # 部署文档
└── QUICKSTART.md               # 本文件
```

---

## 🔧 常用命令

### 开发命令

```bash
# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 启动开发服务器（热重载）
npm run dev

# 启动生产服务器
npm start
```

### Docker 命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

### 数据库命令

```bash
# 备份数据库
cp database/xsztoolbox.db database/backup-$(date +%Y%m%d).db

# 查看数据库内容（需要 SQLite）
sqlite3 database/xsztoolbox.db "SELECT * FROM users LIMIT 10;"

# 查看表结构
sqlite3 database/xsztoolbox.db ".schema users"
```

---

## ⚠️ 注意事项

### 开发环境

- ✅ 可以使用 HTTP
- ✅ CORS 允许所有来源
- ✅ 日志输出到控制台

### 生产环境

- ⚠️ **必须**使用 HTTPS
- ⚠️ **必须**修改所有密钥
- ⚠️ **必须**配置正确的 CORS
- ⚠️ **建议**定期备份数据库

### 安全建议

1. **JWT 密钥**: 使用强随机字符串，至少 32 位
2. **HMAC 密钥**: 定期轮换（可选功能）
3. **管理员 CID**: 不要在代码中硬编码，使用环境变量
4. **数据库**: 定期备份，保留至少 7 天
5. **日志**: 定期清理旧日志，避免占用过多磁盘空间

---

## 🐛 故障排查

### 问题 1: 数据库初始化失败

**错误**: `数据库初始化失败: SQLITE_CANTOPEN`

**解决方法**:
```bash
# 确保 database 目录存在且有写权限
mkdir -p database
chmod 755 database
```

### 问题 2: 端口被占用

**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方法**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### 问题 3: npm install 失败

**错误**: `npm ERR! code ECONNRESET`

**解决方法**:
```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
```

### 问题 4: Docker 构建慢

**解决方法**:
```bash
# 使用国内 Docker Hub 镜像
# 编辑 /etc/docker/daemon.json
{
  "registry-mirrors": ["https://docker.mirrors.ustc.edu.cn"]
}

# 重启 Docker
sudo systemctl restart docker
```

---

## 📚 更多文档

- **部署指南**: 查看 [DEPLOYMENT.md](./DEPLOYMENT.md)
- **管理面板**: 查看 [admin-panel/README.md](./admin-panel/README.md)
- **API 文档**: 查看 [README.md](./README.md)

---

## 🎉 恭喜！

如果您看到这里，说明后端服务已经成功启动！

接下来：
1. 访问管理面板测试功能
2. 配置前端插件连接到后端
3. 部署到生产环境（可选）

**有问题？** 提交 GitHub Issue 或查看日志排查。

祝使用愉快！🚀
