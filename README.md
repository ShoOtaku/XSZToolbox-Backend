# XSZToolbox 后端服务

基于 Node.js + Express + SQLite 的个人服务器后端，用于支持 XSZToolbox Dalamud 插件的在线验证功能。

## 功能特性

- ✅ 在线白名单验证
- ✅ 管理员 Web 面板
- ✅ 用户管理系统（管理员/普通用户角色）
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

**重要环境变量说明：**

| 变量名 | 说明 | 默认值 | 必须修改 |
|--------|------|--------|----------|
| `JWT_SECRET` | JWT 令牌签名密钥 | - | ✅ 是 |
| `ADMIN_USERNAME` | 初始管理员用户名 | admin | ⚠️ 建议 |
| `ADMIN_PASSWORD` | 初始管理员密码 | change_me_immediately | ✅ 是 |
| `HMAC_SECRET` | HMAC 签名密钥 | - | ✅ 是 |
| `HASH_SALT` | CID 哈希盐值 | XSZToolbox_CID_Salt_2025 | ⚠️ 建议 |
| `REQUIRE_HTTPS` | 是否强制 HTTPS | true | - |
| `DATABASE_PATH` | 数据库文件路径 | ./database/xsztoolbox.db | - |

⚠️ **安全提示**：
- 首次部署后，请立即通过管理面板修改默认管理员密码
- 生产环境必须使用强密码（至少 12 个字符，包含大小写字母、数字和特殊字符）
- 定期更换 JWT_SECRET 和 HMAC_SECRET

### 3. 初始化数据库

```bash
npm run init-db
```

这将创建数据库并初始化默认管理员账号（使用 .env 中配置的用户名和密码）。

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 用户管理系统

系统支持两种用户角色：

- **管理员 (admin)**: 拥有完整权限，可以管理白名单、用户、查看所有数据
- **普通用户 (viewer)**: 只读权限，仅能查看房间列表和房间成员信息

### 首次登录

1. 访问管理面板：`https://your-domain.com/admin/`
2. 使用 .env 中配置的 ADMIN_USERNAME 和 ADMIN_PASSWORD 登录
3. 登录后立即前往"账号设置"修改密码

### 创建新用户

1. 以管理员身份登录
2. 进入"用户管理"页面
3. 点击"创建用户"按钮
4. 填写用户名、密码和角色
5. 保存后，新用户即可使用创建的凭证登录

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

## 数据库迁移

如果从旧版本升级，需要运行迁移脚本：

```bash
# 用户管理系统迁移
node src/scripts/migrate-user-management.js

# 其他迁移脚本
node src/scripts/migrate-remote-system.js
node src/scripts/migrate-add-publish-fields.js
```

## 安全建议

1. ⚠️ **必须修改** `.env` 中的所有密钥和默认密码
2. ⚠️ **生产环境必须启用** HTTPS (`REQUIRE_HTTPS=true`)
3. ⚠️ **首次登录后立即修改** 默认管理员密码
4. ⚠️ **定期备份** SQLite 数据库文件
5. ⚠️ **配置防火墙** 仅开放必要端口
6. ⚠️ **启用速率限制** 防止滥用
7. ⚠️ **定期审查** 审计日志，发现异常行为

## 许可证

与 XSZToolbox 主项目保持一致

## 维护者

XSZ
