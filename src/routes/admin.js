/**
 * 管理员 API 路由
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');
const loginAttemptLimiter = require('../middleware/loginAttemptLimiter');

/**
 * POST /api/admin/login
 * 管理员登录（不需要 JWT）
 */
router.post('/login',
  loginLimiter,
  loginAttemptLimiter,
  auditLog('admin_login'),
  adminController.login
);

// 以下所有路由都需要 JWT 认证
router.use(verifyToken);

/**
 * GET /api/admin/stats
 * 获取统计数据（仅管理员）
 */
router.get('/stats',
  requireRole(['admin']),
  adminController.getStats
);

/**
 * POST /api/admin/whitelist/add
 * 添加白名单（仅管理员）
 */
router.post('/whitelist/add',
  requireRole(['admin']),
  auditLog('whitelist_add'),
  adminController.addWhitelist
);

/**
 * DELETE /api/admin/whitelist/:hash
 * 移除白名单（仅管理员）
 */
router.delete('/whitelist/:hash',
  requireRole(['admin']),
  auditLog('whitelist_remove'),
  adminController.removeWhitelist
);

/**
 * PUT /api/admin/whitelist/:hash
 * 更新白名单（仅管理员）
 */
router.put('/whitelist/:hash',
  requireRole(['admin']),
  auditLog('whitelist_update'),
  adminController.updateWhitelist
);

/**
 * GET /api/admin/users
 * 获取所有用户列表（仅管理员）
 */
router.get('/users',
  requireRole(['admin']),
  adminController.getUsers
);

/**
 * GET /api/admin/whitelist
 * 获取所有白名单（仅管理员）
 */
router.get('/whitelist',
  requireRole(['admin']),
  adminController.getAllWhitelist
);

/**
 * GET /api/admin/logs
 * 获取审计日志（仅管理员）
 */
router.get('/logs',
  requireRole(['admin']),
  adminController.getLogs
);

// ==================== 房间管理路由 ====================

/**
 * GET /api/admin/rooms
 * 获取房间列表（支持状态筛选）
 * 权限：admin 和 viewer 都可访问
 */
router.get('/rooms',
  requireRole(['admin', 'viewer']),
  adminController.getAllRooms
);

/**
 * GET /api/admin/rooms/:roomId/members
 * 获取房间成员详情
 * 权限：admin 和 viewer 都可访问
 */
router.get('/rooms/:roomId/members',
  requireRole(['admin', 'viewer']),
  adminController.getRoomMembers
);

/**
 * DELETE /api/admin/rooms/:roomId
 * 管理员强制关闭房间
 * 权限：仅 admin 可用
 */
router.delete('/rooms/:roomId',
  requireRole(['admin']),
  auditLog('room_close'),
  adminController.adminCloseRoom
);



/**
 * PUT /api/admin/room/:roomId/member/:cidHash/job
 * 更新成员职能标识
 * 权限：仅 admin 可用
 */
router.put('/room/:roomId/member/:cidHash/job',
  requireRole(['admin']),
  auditLog('update_member_job_role'),
  adminController.updateMemberJobRole
);

/**
 * PUT /api/admin/room/:roomId/member/:cidHash/role
 * 更新成员权限角色
 * 权限：仅 admin 可用
 */
router.put('/room/:roomId/member/:cidHash/role',
  requireRole(['admin']),
  auditLog('update_member_role'),
  adminController.updateMemberRole
);

/**
 * POST /api/admin/room/:roomId/command
 * 发送房间指令
 * 权限：仅 admin 可用
 */
router.post('/room/:roomId/command',
  requireRole(['admin']),
  auditLog('send_room_command'),
  adminController.sendRoomCommand
);

/**
 * GET /api/admin/room/:roomId/commands
 * 获取房间指令历史
 * 权限：admin 和 viewer 都可访问
 */
router.get('/room/:roomId/commands',
  requireRole(['admin', 'viewer']),
  adminController.getRoomCommandHistory
);


// ==================== 用户管理路由 ====================

/**
 * GET /api/admin/users/list
 * 获取用户列表（仅管理员）
 */
router.get('/users/list',
  requireRole(['admin']),
  adminController.getUserList
);

/**
 * POST /api/admin/users/create
 * 创建用户（仅管理员）
 */
router.post('/users/create',
  requireRole(['admin']),
  auditLog('user_create'),
  adminController.createUser
);

/**
 * PUT /api/admin/users/:id
 * 更新用户信息（仅管理员）
 */
router.put('/users/:id',
  requireRole(['admin']),
  auditLog('user_update'),
  adminController.updateUser
);

/**
 * DELETE /api/admin/users/:id
 * 删除用户（仅管理员）
 */
router.delete('/users/:id',
  requireRole(['admin']),
  auditLog('user_delete'),
  adminController.deleteUser
);


// ==================== 账号管理路由 ====================

/**
 * POST /api/admin/account/change-password
 * 修改当前用户密码
 */
router.post('/account/change-password',
  auditLog('password_change'),
  adminController.changePassword
);

/**
 * PUT /api/admin/account/change-username
 * 修改当前用户名
 */
router.put('/account/change-username',
  auditLog('username_change'),
  adminController.changeUsername
);


module.exports = router;
