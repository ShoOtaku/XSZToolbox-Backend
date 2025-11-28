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

// ==================== 房间管理路由 ====================

/**
 * GET /api/admin/rooms
 * 获取房间列表（支持状态筛选）
 */
router.get('/rooms',
  adminController.getAllRooms
);

/**
 * GET /api/admin/rooms/:roomId/members
 * 获取房间成员详情
 */
router.get('/rooms/:roomId/members',
  adminController.getRoomMembers
);

/**
 * DELETE /api/admin/rooms/:roomId
 * 管理员强制关闭房间
 */
router.delete('/rooms/:roomId',
  auditLog('room_close'),
  adminController.adminCloseRoom
);

module.exports = router;
