# 中间件使用指南

## 权限控制中间件

### requireRole 中间件

用于基于角色的访问控制（RBAC），确保只有特定角色的用户才能访问某些 API 端点。

#### 使用方法

```javascript
const { verifyToken, requireRole } = require('./middleware/auth');

// 仅允许 admin 访问
router.get('/api/admin/users', 
  verifyToken,           // 先验证 JWT Token
  requireRole('admin'),  // 再检查角色
  userController.getUsers
);

// 允许 admin 和 viewer 访问
router.get('/api/admin/rooms', 
  verifyToken,
  requireRole(['admin', 'viewer']),  // 传入角色数组
  roomController.getRooms
);
```

#### 参数

- `allowedRoles`: 字符串或字符串数组，指定允许访问的角色
  - 单个角色: `requireRole('admin')`
  - 多个角色: `requireRole(['admin', 'viewer'])`

#### 响应

- **成功**: 继续执行下一个中间件
- **失败**: 返回 403 Forbidden
  ```json
  {
    "success": false,
    "error": "Forbidden",
    "message": "权限不足"
  }
  ```

### loginAttemptLimiter 中间件

用于防止暴力破解攻击，限制登录失败次数。

#### 使用方法

```javascript
const loginAttemptLimiter = require('./middleware/loginAttemptLimiter');
const { loginLimiter } = require('./middleware/rateLimit');

// 在登录路由中使用
router.post('/api/admin/login',
  loginLimiter,           // 先限制请求频率
  loginAttemptLimiter,    // 再检查登录失败次数
  adminController.login
);
```

#### 功能

- 跟踪每个用户名 + IP 地址的登录失败次数
- 15 分钟内失败 5 次后，临时锁定账号
- 登录成功后，需要在控制器中调用 `clearLoginAttempts` 清除失败记录

#### 响应

- **允许登录**: 继续执行下一个中间件
- **账号锁定**: 返回 429 Too Many Requests
  ```json
  {
    "success": false,
    "error": "Too many attempts",
    "message": "登录失败次数过多，请 15 分钟后再试"
  }
  ```

## 完整示例

### 登录控制器

```javascript
const AdminModel = require('../models/adminModel');
const { generateToken } = require('../middleware/auth');

async function login(req, res) {
  const { username, password } = req.body;
  const ipAddress = req.ip;
  
  try {
    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);
    
    // 验证用户名和密码
    const admin = adminModel.getAdminByUsername(username);
    if (!admin) {
      // 记录失败
      adminModel.recordLoginAttempt(username, ipAddress, false);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      // 记录失败
      adminModel.recordLoginAttempt(username, ipAddress, false);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 登录成功
    adminModel.recordLoginAttempt(username, ipAddress, true);
    adminModel.clearLoginAttempts(username, ipAddress);  // 清除失败记录
    adminModel.updateLoginInfo(username);  // 更新登录信息
    
    // 生成 Token
    const token = generateToken(username, admin.role);
    
    res.json({
      success: true,
      token,
      user: {
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    logger.error(`登录错误: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
}
```

### 用户管理路由

```javascript
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const userController = require('../controllers/userController');

// 获取用户列表（仅 admin）
router.get('/list', 
  verifyToken,
  requireRole('admin'),
  userController.getUserList
);

// 创建用户（仅 admin）
router.post('/create',
  verifyToken,
  requireRole('admin'),
  userController.createUser
);

// 更新用户（仅 admin）
router.put('/:id',
  verifyToken,
  requireRole('admin'),
  userController.updateUser
);

// 删除用户（仅 admin）
router.delete('/:id',
  verifyToken,
  requireRole('admin'),
  userController.deleteUser
);

module.exports = router;
```

### 房间管理路由

```javascript
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const roomController = require('../controllers/roomController');

// 查看房间列表（admin 和 viewer 都可以）
router.get('/',
  verifyToken,
  requireRole(['admin', 'viewer']),
  roomController.getRooms
);

// 查看房间详情（admin 和 viewer 都可以）
router.get('/:roomId/members',
  verifyToken,
  requireRole(['admin', 'viewer']),
  roomController.getRoomMembers
);

// 关闭房间（仅 admin）
router.delete('/:roomId',
  verifyToken,
  requireRole('admin'),
  roomController.closeRoom
);

module.exports = router;
```

## 注意事项

1. **中间件顺序很重要**:
   - 先使用 `verifyToken` 验证 JWT Token
   - 再使用 `requireRole` 检查角色权限
   - 对于登录路由，先使用 `loginLimiter`，再使用 `loginAttemptLimiter`

2. **登录失败记录**:
   - 必须在登录控制器中调用 `recordLoginAttempt` 记录失败
   - 登录成功后必须调用 `clearLoginAttempts` 清除失败记录
   - 否则用户可能被永久锁定

3. **角色定义**:
   - `admin`: 完整权限，可以访问所有功能
   - `viewer`: 只读权限，只能查看房间信息

4. **错误处理**:
   - 所有中间件都会记录日志
   - 权限不足会返回 403 Forbidden
   - 账号锁定会返回 429 Too Many Requests
