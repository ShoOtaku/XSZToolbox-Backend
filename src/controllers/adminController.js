/**
 * 管理员控制器
 */

const AdminModel = require('../models/adminModel');
const UserModel = require('../models/userModel');
const WhitelistModel = require('../models/whitelistModel');
const AuditLogModel = require('../models/auditLogModel');
const dbManager = require('../models/database');
const logger = require('../utils/logger');
const { generateToken } = require('../middleware/auth');

/**
 * 管理员登录
 * POST /api/admin/login
 */
async function login(req, res) {
  try {
    const { cid_hash } = req.body;

    if (!cid_hash || cid_hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cid_hash',
        message: '无效的 CID 哈希'
      });
    }

    // 获取数据库实例
    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 检查是否为管理员
    const admin = adminModel.getAdmin(cid_hash);

    if (!admin) {
      logger.warn(`❌ 管理员登录失败: ${cid_hash} - 非管理员`);
      return res.status(403).json({
        success: false,
        error: 'Not an admin',
        message: '您不是管理员'
      });
    }

    // 生成 JWT Token
    const token = generateToken(admin.cid_hash, admin.role);
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    logger.info(`✅ 管理员登录成功: ${cid_hash}`);

    res.json({
      success: true,
      token,
      expires_in: expiresIn,
      role: admin.role,
      message: '登录成功'
    });

  } catch (error) {
    logger.error(`❌ 管理员登录失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取统计数据
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  try {
    const db = dbManager.getDb();
    const userModel = new UserModel(db);
    const whitelistModel = new WhitelistModel(db);
    const auditLogModel = new AuditLogModel(db);

    const stats = {
      total_users: userModel.getUserCount(),
      active_today: userModel.getTodayActiveCount(),
      new_users_7d: userModel.getNewUsersCount(7),
      whitelist_count: whitelistModel.getWhitelistCount(),
      total_logs: auditLogModel.getLogCount(),
      top_servers: userModel.getTopServers(10),
      recent_logs: auditLogModel.getLogStats(24)
    };

    logger.info(`✅ 统计数据查询成功: ${req.admin.cidHash}`);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error(`❌ 统计数据查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 添加白名单
 * POST /api/admin/whitelist/add
 */
async function addWhitelist(req, res) {
  try {
    const { cid_hash, note, expires_at } = req.body;

    if (!cid_hash || cid_hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cid_hash',
        message: '无效的 CID 哈希'
      });
    }

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const success = whitelistModel.addToWhitelist({
      cidHash: cid_hash,
      note: note || '',
      addedBy: req.admin.cidHash,
      expiresAt: expires_at || null
    });

    if (success) {
      logger.info(`✅ 添加白名单成功: ${cid_hash} by ${req.admin.cidHash}`);
      res.json({
        success: true,
        message: '已添加到白名单'
      });
    } else {
      logger.warn(`⚠️ 添加白名单失败: ${cid_hash} - 已存在`);
      res.status(409).json({
        success: false,
        error: 'Already exists',
        message: '该用户已在白名单中'
      });
    }

  } catch (error) {
    logger.error(`❌ 添加白名单失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 移除白名单
 * DELETE /api/admin/whitelist/:hash
 */
async function removeWhitelist(req, res) {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hash',
        message: '无效的哈希值'
      });
    }

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const success = whitelistModel.removeFromWhitelist(hash);

    if (success) {
      logger.info(`✅ 移除白名单成功: ${hash} by ${req.admin.cidHash}`);
      res.json({
        success: true,
        message: '已从白名单移除'
      });
    } else {
      logger.warn(`⚠️ 移除白名单失败: ${hash} - 不存在`);
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: '该用户不在白名单中'
      });
    }

  } catch (error) {
    logger.error(`❌ 移除白名单失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取所有用户列表
 * GET /api/admin/users
 */
async function getUsers(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const db = dbManager.getDb();
    const userModel = new UserModel(db);

    const users = userModel.getAllUsers(parseInt(limit), parseInt(offset));
    const total = userModel.getUserCount();

    logger.info(`✅ 用户列表查询成功: ${users.length} 条记录`);

    res.json({
      success: true,
      users,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error(`❌ 用户列表查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取所有白名单
 * GET /api/admin/whitelist
 */
async function getAllWhitelist(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const whitelist = whitelistModel.getAllWhitelist(parseInt(limit), parseInt(offset));
    const total = whitelistModel.getWhitelistCount();

    logger.info(`✅ 白名单查询成功: ${whitelist.length} 条记录`);

    res.json({
      success: true,
      whitelist,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error(`❌ 白名单查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取审计日志
 * GET /api/admin/logs
 */
async function getLogs(req, res) {
  try {
    const { limit = 100, offset = 0, action } = req.query;

    const db = dbManager.getDb();
    const auditLogModel = new AuditLogModel(db);

    const logs = auditLogModel.getLogs(parseInt(limit), parseInt(offset), action);
    const total = auditLogModel.getLogCount();

    logger.info(`✅ 审计日志查询成功: ${logs.length} 条记录`);

    res.json({
      success: true,
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error(`❌ 审计日志查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

module.exports = {
  login,
  getStats,
  addWhitelist,
  removeWhitelist,
  getUsers,
  getAllWhitelist,
  getLogs
};
