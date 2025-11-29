# 账号管理 API 测试指南

本文档说明如何测试新实现的账号管理 API。

## 前置条件

1. 确保后端服务正在运行
2. 已有一个管理员账号（用户名/密码）
3. 已获取有效的 JWT Token

## 获取 JWT Token

```bash
# 登录获取 Token
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'

# 响应示例
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": "24h",
  "role": "admin",
  "username": "admin",
  "message": "登录成功"
}
```

## 测试 1: 修改密码

### 请求

```bash
curl -X POST http://localhost:3000/api/admin/account/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "current_password": "old_password",
    "new_password": "new_password_123"
  }'
```

### 预期响应（成功）

```json
{
  "success": true,
  "message": "密码修改成功，请重新登录"
}
```

### 预期响应（当前密码错误）

```json
{
  "success": false,
  "error": "Invalid password",
  "message": "当前密码错误"
}
```

### 预期响应（新密码太短）

```json
{
  "success": false,
  "error": "Weak password",
  "message": "新密码至少需要 8 个字符"
}
```

## 测试 2: 修改用户名

### 请求

```bash
curl -X PUT http://localhost:3000/api/admin/account/change-username \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "new_username": "new_admin",
    "password": "current_password"
  }'
```

### 预期响应（成功）

```json
{
  "success": true,
  "message": "用户名修改成功，请重新登录",
  "new_username": "new_admin"
}
```

### 预期响应（密码错误）

```json
{
  "success": false,
  "error": "Invalid password",
  "message": "密码错误"
}
```

### 预期响应（用户名已存在）

```json
{
  "success": false,
  "error": "Username exists",
  "message": "用户名已存在"
}
```

## 测试 3: 验证审计日志

修改密码和用户名后，应该在审计日志中看到相应的记录：

```bash
curl -X GET http://localhost:3000/api/admin/logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

应该看到 `account_change_password` 和 `account_change_username` 的日志记录。

## 测试 4: 验证会话失效

修改密码后，旧的 JWT Token 应该仍然有效（直到过期），但用户应该重新登录以获取新的 Token。

修改用户名后，旧的 JWT Token 中的用户名将不再匹配，下次验证时会失败。

## 注意事项

1. 修改密码后，建议用户重新登录
2. 修改用户名后，必须使用新用户名重新登录
3. 所有操作都会记录审计日志
4. 新密码必须至少 8 个字符
5. 用户名必须唯一

## 服务器部署测试

在生产服务器上测试：

```bash
# SSH 连接到服务器
ssh root@8.138.96.37

# 进入后端目录
cd /opt/xsztoolbox/XSZToolbox-Backend

# 拉取最新代码
git pull origin main

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f --tail=50

# 测试 API（使用服务器的实际地址）
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```
