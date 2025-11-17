/**
 * 管理员 API 路由
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');

/**
 * POST /api/admin/login
 * 管理员登录（不需要 JWT）
 */
router.post('/login',
  loginLimiter,
  auditLog('admin_login'),
  adminController.login
);

// 以下所有路由都需要 JWT 认证
router.use(verifyToken);

/**
 * GET /api/admin/stats
 * 获取统计数据
 */
router.get('/stats',
  adminController.getStats
);

/**
 * POST /api/admin/whitelist/add
 * 添加白名单
 */
router.post('/whitelist/add',
  auditLog('whitelist_add'),
  adminController.addWhitelist
);

/**
 * DELETE /api/admin/whitelist/:hash
 * 移除白名单
 */
router.delete('/whitelist/:hash',
  auditLog('whitelist_remove'),
  adminController.removeWhitelist
);

/**
 * PUT /api/admin/whitelist/:hash
 * 更新白名单
 */
router.put('/whitelist/:hash',
  auditLog('whitelist_update'),
  adminController.updateWhitelist
);

/**
 * GET /api/admin/users
 * 获取所有用户列表
 */
router.get('/users',
  adminController.getUsers
);

/**
 * GET /api/admin/whitelist
 * 获取所有白名单
 */
router.get('/whitelist',
  adminController.getAllWhitelist
);

/**
 * GET /api/admin/logs
 * 获取审计日志
 */
router.get('/logs',
  adminController.getLogs
);

module.exports = router;
