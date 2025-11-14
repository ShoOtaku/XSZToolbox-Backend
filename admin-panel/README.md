# XSZToolbox Web 管理面板使用说明

## 📋 功能概述

这是一个纯 HTML/CSS/JavaScript 实现的单页应用（SPA），无需编译构建，可直接运行。

### 主要功能

- ✅ **管理员登录** - 使用 CID 哈希登录，JWT Token 认证
- 📊 **仪表盘** - 实时统计数据、服务器排行榜、最近活动
- ✅ **白名单管理** - 添加/删除白名单用户
- 👥 **用户列表** - 查看所有提交数据的用户
- 📝 **审计日志** - 查看所有操作记录，支持过滤

---

## 🚀 快速开始

### 方式一：通过后端服务访问

如果后端服务已启动，直接访问：

```
http://localhost:3000/admin
```

### 方式二：独立运行（开发测试）

```bash
cd admin-panel

# 使用 Python 启动简单服务器
python -m http.server 8080

# 或使用 Node.js http-server
npx http-server -p 8080
```

然后访问 `http://localhost:8080`

---

## 🔐 登录方式

### 获取管理员 CID 哈希

管理员 CID 哈希需要使用与插件相同的算法计算：

```javascript
// JavaScript 示例
const crypto = require('crypto');

function computeCIDHash(contentId) {
    const salt = 'XSZToolbox_CID_Salt_2025';
    const input = `${salt}${contentId}`;
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex').toUpperCase();
}

// 示例
const cidHash = computeCIDHash('18014449511126809');
console.log(cidHash);  // 输出 64 位哈希
```

或使用在线工具：
1. 访问 https://emn178.github.io/online-tools/sha256.html
2. 输入: `XSZToolbox_CID_Salt_202518014449511126809` (盐值+CID)
3. 点击 Hash，得到 64 位哈希值
4. 转换为大写

### 配置管理员

在后端 `.env` 文件中配置：

```bash
ADMIN_CID_HASHES=A7F3C9E2D4B1F8A6EXAMPLE1,B8G4D0F3E5C2G9B7EXAMPLE2
```

多个管理员用逗号分隔。

---

## 📖 功能说明

### 1. 仪表盘

- **统计卡片**: 总用户数、今日活跃、白名单数量、7日新增
- **服务器排行榜**: 显示用户最多的前 10 个服务器
- **最近活动**: 显示最近 24 小时的操作统计

**刷新数据**: 点击右上角 "🔄 刷新数据" 按钮

### 2. 白名单管理

#### 添加白名单

1. 点击 "➕ 添加白名单" 按钮
2. 输入用户的 CID 哈希（64 位）
3. 输入备注信息（可选）
4. 点击 "✅ 确认添加"

#### 删除白名单

1. 在白名单列表中找到目标用户
2. 点击 "删除" 按钮
3. 确认删除操作

### 3. 用户列表

显示所有提交过数据的用户，包括：
- CID 哈希
- 角色名
- 服务器名
- 首次登录时间
- 最后登录时间
- 登录次数

**刷新列表**: 点击右上角 "🔄 刷新" 按钮

### 4. 审计日志

查看所有操作记录，支持按操作类型过滤：
- 用户提交
- 用户验证
- 管理员登录
- 添加白名单
- 移除白名单

**过滤日志**: 使用下拉菜单选择操作类型，自动刷新

---

## 🔧 技术细节

### 技术栈

- **前端**: 纯 HTML + CSS + Vanilla JavaScript
- **认证**: JWT Token (localStorage 存储)
- **API**: Fetch API
- **响应式**: 支持移动端和桌面端

### 文件结构

```
admin-panel/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 主应用逻辑
│   ├── api.js          # API 调用封装
│   └── auth.js         # 认证管理
└── README.md           # 使用说明
```

### API 地址自动检测

管理面板会自动检测 API 地址：
- 通过后端访问时 (`/admin`)：使用当前域名
- 独立运行时：默认使用 `http://localhost:3000`

如需修改，编辑 `js/api.js` 中的 `detectAPIUrl()` 方法。

### Token 存储

JWT Token 存储在 localStorage 中，键名为 `xsz_admin_token`。

Token 过期后会自动登出。

---

## 🛡️ 安全建议

### 生产环境部署

1. **必须启用 HTTPS**
   - 修改后端 `.env`: `REQUIRE_HTTPS=true`
   - 配置 SSL 证书（Let's Encrypt）

2. **配置强密码**
   - 使用强随机字符串作为 JWT 密钥
   - 定期轮换管理员 CID 哈希

3. **启用速率限制**
   - 防止暴力破解登录
   - 限制 API 请求频率

4. **定期备份数据库**
   - 每天自动备份 SQLite 数据库
   - 保留至少 7 天的备份

### 访问控制

- 仅允许管理员 IP 访问（通过防火墙）
- 使用 VPN 或跳板机连接生产服务器
- 不要在公共网络使用管理面板

---

## 🔍 常见问题

### 1. 登录失败

**原因**:
- CID 哈希错误
- 后端服务未启动
- CORS 配置问题

**解决方法**:
1. 检查 CID 哈希是否正确（64 位大写）
2. 确认后端服务是否运行: `curl http://localhost:3000/api/health`
3. 检查浏览器控制台错误信息

### 2. Token 过期

**原因**: JWT Token 默认 24 小时过期

**解决方法**: 重新登录即可

### 3. 数据加载失败

**原因**:
- 网络连接问题
- 后端数据库错误
- API 权限问题

**解决方法**:
1. 检查网络连接
2. 查看后端日志: `docker-compose logs -f`
3. 刷新页面重试

### 4. 样式显示异常

**原因**: 浏览器缓存

**解决方法**: 强制刷新页面 (Ctrl + F5)

---

## 📊 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ❌ IE 11 及以下不支持

---

## 🎨 自定义样式

如需修改样式，编辑 `css/style.css` 中的 CSS 变量：

```css
:root {
    --primary-color: #4a90e2;      /* 主色调 */
    --danger-color: #dc3545;       /* 危险色 */
    --success-color: #28a745;      /* 成功色 */
    /* ... 其他颜色 */
}
```

---

## 📞 技术支持

如有问题，请提交 GitHub Issue 或查看后端日志排查。

---

**祝使用愉快！** 🎉
