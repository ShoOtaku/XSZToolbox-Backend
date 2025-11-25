# 在线验证修复指南

## 📋 问题说明

当前后端的 CID 哈希算法存在错误，导致即使用户已添加到白名单，验证时仍会失败。

**错误原因**：
- **客户端算法**：`SHA256(Salt + CID)` ✅ 正确
- **后端算法**：`SHA256(CID + Salt)` ❌ 错误

由于哈希算法不一致，导致客户端发送的哈希值与后端数据库中存储的哈希值不匹配。

---

## 🔧 修复步骤

### 1️⃣ 修复后端哈希算法

已修复文件：`src/controllers/userController.js`

**修改内容**：
```javascript
// 旧代码（错误）
const calculatedHash = crypto.createHash('sha256')
  .update(plainCid + 'XSZToolbox_CID_Salt_2025')  // ❌
  .digest('hex');

// 新代码（正确）
const calculatedHash = crypto.createHash('sha256')
  .update('XSZToolbox_CID_Salt_2025' + plainCid)  // ✅
  .digest('hex')
  .toUpperCase();
```

---

### 2️⃣ 修复数据库中的现有哈希

如果数据库中已经存在用户记录，需要重新计算所有哈希值。

```bash
cd XSZToolbox-Backend
node fix-whitelist-hashes.js
```

**脚本功能**：
- 读取所有白名单用户（有明文 CID 的记录）
- 使用正确的算法重新计算哈希
- 更新数据库中的 `cid_hash` 字段
- 验证修复结果

**输出示例**：
```
========================================
🔧 开始修复白名单哈希值
========================================

📋 找到 3 条白名单记录

✅ [ID 1] 哈希已更新
  CID: 18014449511126809
  旧哈希: ABCD1234...
  新哈希: 8A9F2E3D...
  备注: 测试用户

✓ [ID 2] 哈希已正确，跳过
  ...

========================================
📊 修复完成统计
========================================
✅ 成功更新: 2 条
✓ 已经正确: 1 条
❌ 更新失败: 0 条
📋 总计处理: 3 条
```

---

### 3️⃣ 重启后端服务

修复完成后，需要重启后端服务以应用代码更改：

```bash
# 停止当前服务（Ctrl+C）
# 然后重新启动
npm run dev
```

---

### 4️⃣ 测试验证功能

使用测试工具验证修复是否成功：

```bash
node test-verify.js <你的CID>
```

**示例**：
```bash
node test-verify.js 18014449511126809
```

**成功输出**：
```
========================================
🔍 XSZToolbox 验证测试
========================================

📝 步骤 1: 计算 CID 哈希
   CID (明文): 18014449511126809
   CID Hash:   8A9F2E3D4C5B6A7F...
   算法:       SHA256(Salt + CID)

🌐 步骤 2: 测试验证 API
   API URL:    http://localhost:3000/api/verify/...

✅ API 请求成功
   HTTP 状态:  200 OK
   响应时间:   45ms

📦 响应数据:
{
  "authorized": true,
  "status": "whitelisted",
  "note": "测试用户",
  "permissions": ["all"]
}

========================================
📊 验证结果分析
========================================

✅ 验证通过！用户已授权
   状态:       whitelisted
   备注:       测试用户
   权限:       ["all"]
```

**失败输出**：
```
========================================
📊 验证结果分析
========================================

❌ 验证未通过
   状态:       not_whitelisted
   原因:       用户不在白名单中

💡 可能的解决方案:
   1. 确认 CID 已添加到后端白名单
   2. 运行 fix-whitelist-hashes.js 修复数据库哈希
   3. 检查数据库 whitelist 表中的 authorized 字段是否为 1
   4. 确认哈希计算算法与客户端一致（Salt + CID）
```

---

### 5️⃣ 游戏内测试

1. **重新编译插件**（如果修改了客户端代码）：
   ```bash
   cd Y:\03代码\Github\XSZToolbox
   dotnet build XSZToolbox.sln -c Release
   ```

2. **启动游戏**，打开 XSZToolbox 主窗口（`/xsz`）

3. **查看验证标签页**，应该显示"✅ 在线验证通过"

4. **查看 Dalamud 日志**（`/xllog`），搜索 `PersonalServerModule`，应该看到详细的验证日志：
   ```
   [PersonalServerModule] ========== 在线验证开始 ==========
   [PersonalServerModule] CID (明文): 18014449511126809
   [PersonalServerModule] CID Hash: 8A9F2E3D...
   [PersonalServerModule] API URL: http://localhost:3000/api
   [PersonalServerModule] 请求 URL: http://localhost:3000/api/verify/...
   [PersonalServerModule] HTTP 状态: 200 OK
   [PersonalServerModule] 响应 Authorized: True
   [PersonalServerModule] ✅ 在线验证通过
   [PersonalServerModule] ========== 在线验证结束 ==========
   ```

---

## 🛠️ 手动验证数据库

如果需要手动检查数据库：

```bash
cd XSZToolbox-Backend
sqlite3 database/xsztoolbox.db
```

**查询所有白名单用户**：
```sql
SELECT
  id,
  cid,
  cid_hash,
  note,
  authorized,
  expires_at
FROM whitelist
ORDER BY id;
```

**检查特定用户**：
```sql
SELECT * FROM whitelist
WHERE cid = '你的CID'
OR cid_hash = '计算的哈希';
```

**手动添加用户**：
```sql
INSERT INTO whitelist (cid, cid_hash, note, added_by, authorized)
VALUES (
  '18014449511126809',
  '8A9F2E3D4C5B6A7F...',  -- 使用正确算法计算的哈希
  '手动添加',
  'admin',
  1
);
```

**验证哈希是否正确**：
1. 使用 `test-verify.js` 计算正确的哈希
2. 对比数据库中存储的哈希
3. 如果不一致，运行 `fix-whitelist-hashes.js`

---

## 📊 验证流程图

```
┌─────────────────────────────────────────────────┐
│ 1. 客户端启动，获取玩家 CID                      │
│    CID = 18014449511126809                      │
└────────────────┬────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. 客户端计算哈希                                │
│    Hash = SHA256("Salt" + CID)                  │
│    = 8A9F2E3D4C5B6A7F...                        │
└────────────────┬────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. 发送 HTTP 请求到后端                          │
│    GET /api/verify/8A9F2E3D...                  │
└────────────────┬────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│ 4. 后端查询数据库                                │
│    SELECT * FROM whitelist                      │
│    WHERE cid_hash = '8A9F2E3D...'               │
└────────────────┬────────────────────────────────┘
                 ▼
      ┌──────────┴──────────┐
      ▼                     ▼
┌────────────┐        ┌─────────────┐
│ 找到记录    │        │ 未找到记录   │
│ authorized=1│        │              │
└─────┬──────┘        └──────┬──────┘
      ▼                      ▼
┌────────────┐        ┌─────────────┐
│ 返回 200    │        │ 返回 200     │
│ authorized: │        │ authorized:  │
│ true        │        │ false        │
└─────┬──────┘        └──────┬──────┘
      └──────────┬────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│ 5. 客户端处理响应                                │
│    - 更新验证状态                                │
│    - 显示在 UI 上                                │
│    - 记录详细日志                                │
└─────────────────────────────────────────────────┘
```

---

## ❓ 常见问题

### Q1: 修复后验证仍然失败？

**检查清单**：
- [ ] 后端服务已重启
- [ ] 数据库哈希已修复（运行 `fix-whitelist-hashes.js`）
- [ ] 客户端已重新编译（如果修改了代码）
- [ ] 网络连接正常，能访问后端 API
- [ ] 后端服务器地址配置正确（`ServerConfig.ApiBaseUrl`）

### Q2: test-verify.js 报错 "无法连接到服务器"？

**可能原因**：
1. 后端服务未启动 → 运行 `npm run dev`
2. 端口号错误 → 检查 API URL（默认 `http://localhost:3000/api`）
3. 防火墙阻止 → 临时关闭防火墙测试

### Q3: 数据库中没有明文 CID？

**说明**：
- 只有通过**新版客户端**提交的用户数据才包含明文 CID
- 旧版客户端只提交了哈希值，无法修复
- **解决方案**：
  1. 让用户重新登录（使用新版客户端）
  2. 或手动计算哈希后添加到白名单

### Q4: 如何计算 CID 的正确哈希？

**在线计算**：
```bash
node test-verify.js <CID>
# 会显示计算的哈希值
```

**手动计算（Node.js）**：
```javascript
const crypto = require('crypto');
const cid = '18014449511126809';
const salt = 'XSZToolbox_CID_Salt_2025';
const hash = crypto.createHash('sha256')
  .update(salt + cid)
  .digest('hex')
  .toUpperCase();
console.log(hash);
```

---

## 🎯 总结

修复在线验证失败的核心步骤：

1. ✅ **修复后端算法** - 已完成（`userController.js`）
2. ✅ **修复数据库哈希** - 运行 `fix-whitelist-hashes.js`
3. ✅ **重启后端服务** - `npm run dev`
4. ✅ **测试验证** - `node test-verify.js <CID>`
5. ✅ **游戏内验证** - 打开插件查看结果

---

## 📞 技术支持

如果修复后仍有问题，请提供以下信息：

1. **后端日志**（运行 `npm run dev` 时的输出）
2. **客户端日志**（Dalamud `/xllog`，搜索 `PersonalServerModule`）
3. **test-verify.js 输出**
4. **数据库查询结果**（`SELECT * FROM whitelist WHERE cid = '你的CID'`）

---

## 📝 更新日志

- **2025-11-15**: 创建修复指南，修复哈希算法不一致问题
