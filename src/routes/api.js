/**
 * 公共 API 路由
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');

/**
 * POST /api/submit
 * 提交用户数据
 */
router.post('/submit',
  auditLog('user_submit'),
  userController.submitUserData
);

/**
 * GET /api/verify/:hash
 * 验证用户授权
 */
router.get('/verify/:hash',
  verifyLimiter,
  auditLog('user_verify'),
  userController.verifyUser
);

/**
 * GET /api/whitelist
 * 获取白名单（GitHub 格式）
 */
router.get('/whitelist',
  userController.getWhitelist
);

/**
 * GET /api/health
 * 健康检查端点
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
