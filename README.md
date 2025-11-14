# XSZToolbox 后端服务

基于 Node.js + Express + SQLite 的个人服务器后端，用于支持 XSZToolbox Dalamud 插件的在线验证和数据收集功能。

## 功能特性

- ✅ 用户数据收集（角色名、服务器、CID 哈希）
- ✅ 在线白名单验证
- ✅ 管理员 Web 面板
- ✅ 审计日志系统
- ✅ JWT 认证
- ✅ HMAC 请求签名
- ✅ 速率限制防护
- ✅ HTTPS 强制

## 技术栈

- **后端框架**: Express.js
- **数据库**: SQLite3 (WAL 模式)
- **认证**: JWT (jsonwebtoken)
- **日志**: Winston
- **安全**: Helmet, CORS, express-rate-limit

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API 文档

### 公共接口

#### POST /api/submit
提交用户数据

**请求体**:
```json
{
  "cid": "A7F3C9...",
  "characterName": "角色名",
  "worldName": "服务器名",
  "qqInfo": "可选QQ信息"
}
```

**响应**:
```json
{
  "success": true,
  "status": "new_user",
  "message": "数据已记录"
}
```

#### GET /api/verify/:hash
验证 CID 哈希是否在白名单中

**响应**:
```json
{
  "authorized": true,
  "status": "whitelisted",
  "note": "备注信息"
}
```

#### GET /api/whitelist
获取完整白名单（兼容 GitHub 格式）

**响应**:
```json
{
  "version": 1,
  "last_updated": "2025-01-14T12:00:00.000Z",
  "entries": [...]
}
```

### 管理员接口

#### POST /api/admin/login
管理员登录

**请求体**:
```json
{
  "cid_hash": "管理员CID哈希"
}
```

**响应**:
```json
{
  "success": true,
  "token": "JWT令牌",
  "expires_in": "24h"
}
```

#### POST /api/admin/whitelist/add
添加白名单（需要 JWT）

**请求头**:
```
Authorization: Bearer <JWT令牌>
```

**请求体**:
```json
{
  "cid_hash": "用户CID哈希",
  "note": "备注信息"
}
```

#### DELETE /api/admin/whitelist/:hash
移除白名单（需要 JWT）

#### GET /api/admin/stats
获取统计数据（需要 JWT）

## 部署指南

### Docker 部署

```bash
# 构建镜像
docker build -t xsztoolbox-backend .

# 使用 docker-compose 启动
docker-compose up -d
```

### 云平台部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 安全建议

1. ⚠️ **必须修改** `.env` 中的所有密钥
2. ⚠️ **生产环境必须启用** HTTPS (`REQUIRE_HTTPS=true`)
3. ⚠️ **定期备份** SQLite 数据库文件
4. ⚠️ **配置防火墙** 仅开放必要端口
5. ⚠️ **启用速率限制** 防止滥用

## 许可证

与 XSZToolbox 主项目保持一致

## 维护者

XSZ
