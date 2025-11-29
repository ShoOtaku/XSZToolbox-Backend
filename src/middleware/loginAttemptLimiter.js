/**
 * 登录失败锁定中间件
 * 防止暴力破解攻击
 */

const logger = require('../utils/logger');
const AdminModel = require('../models/adminModel');
const dbManager = require('../models/database');

/**
 * 登录失败锁定中间件
 * 连续 5 次失败后锁定 15 分钟
 */
async function loginAttemptLimiter(req, res, next) {
  const { username } = req.body;
  
  // 如果没有提供用户名，跳过检查（让后续的验证处理）
  if (!username) {
    return next();
  }

  // 获取客户端 IP 地址
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    // 获取数据库实例
    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 查询最近 15 分钟内的失败登录次数
    const failedAttempts = adminModel.getFailedAttempts(username, ipAddress, 15);

    // 如果失败次数 >= 5，拒绝登录尝试
    if (failedAttempts >= 5) {
      logger.warn(`❌ 账号锁定: ${username} from ${ipAddress} (失败次数: ${failedAttempts})`);
      return res.status(429).json({
        success: false,
        error: 'Too many attempts',
        message: '登录失败次数过多，请 15 分钟后再试'
      });
    }

    // 记录当前检查的失败次数（用于调试）
    if (failedAttempts > 0) {
      logger.info(`⚠️ 登录尝试: ${username} from ${ipAddress} (已失败 ${failedAttempts} 次)`);
    }

    // 允许继续登录尝试
    next();
  } catch (error) {
    logger.error(`❌ 登录失败锁定中间件错误: ${error.message}`);
    // 出错时允许继续，避免阻止正常登录
    next();
  }
}

module.exports = loginAttemptLimiter;
