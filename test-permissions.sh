#!/bin/bash

echo "=========================================="
echo "测试用户管理系统权限控制"
echo "=========================================="
echo ""

# 测试 1: 管理员登录
echo "1. 测试管理员登录..."
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
  echo "✅ 管理员登录成功"
else
  echo "❌ 管理员登录失败"
  exit 1
fi
echo ""

# 测试 2: Viewer 登录
echo "2. 测试 Viewer 登录..."
VIEWER_TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testviewer2","password":"viewer123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$VIEWER_TOKEN" ]; then
  echo "✅ Viewer 登录成功"
else
  echo "❌ Viewer 登录失败"
  exit 1
fi
echo ""

# 测试 3: Admin 访问房间列表
echo "3. 测试 Admin 访问房间列表..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/admin/rooms \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Admin 可以访问房间列表"
else
  echo "❌ Admin 无法访问房间列表"
fi
echo ""

# 测试 4: Viewer 访问房间列表
echo "4. 测试 Viewer 访问房间列表..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/admin/rooms \
  -H "Authorization: Bearer $VIEWER_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Viewer 可以访问房间列表"
else
  echo "❌ Viewer 无法访问房间列表"
fi
echo ""

# 测试 5: Admin 访问用户管理
echo "5. 测试 Admin 访问用户管理..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/admin/users/list \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Admin 可以访问用户管理"
else
  echo "❌ Admin 无法访问用户管理"
fi
echo ""

# 测试 6: Viewer 访问用户管理（应该被拒绝）
echo "6. 测试 Viewer 访问用户管理（应该被拒绝）..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/admin/users/list \
  -H "Authorization: Bearer $VIEWER_TOKEN")
if echo "$RESPONSE" | grep -q '"success":false'; then
  echo "✅ Viewer 正确被拒绝访问用户管理"
else
  echo "❌ Viewer 不应该能访问用户管理"
fi
echo ""

# 测试 7: Viewer 访问白名单（应该被拒绝）
echo "7. 测试 Viewer 访问白名单（应该被拒绝）..."
RESPONSE=$(curl -s -X GET http://localhost:3000/api/admin/whitelist \
  -H "Authorization: Bearer $VIEWER_TOKEN")
if echo "$RESPONSE" | grep -q '"success":false'; then
  echo "✅ Viewer 正确被拒绝访问白名单"
else
  echo "❌ Viewer 不应该能访问白名单"
fi
echo ""

# 测试 8: Admin 修改密码
echo "8. 测试 Admin 修改密码..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/account/change-password \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"admin123","new_password":"admin123"}')
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Admin 可以修改密码"
else
  echo "❌ Admin 无法修改密码"
fi
echo ""

echo "=========================================="
echo "权限测试完成"
echo "=========================================="
