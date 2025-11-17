/**
 * 管理员控制器
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const AdminModel = require('../models/adminModel');
const UserModel = require('../models/userModel');
const WhitelistModel = require('../models/whitelistModel');
const AuditLogModel = require('../models/auditLogModel');
const dbManager = require('../models/database');
const logger = require('../utils/logger');
const { generateToken } = require('../middleware/auth');

const CID_HASH_SALT = 'XSZToolbox_CID_Salt_2025';

function hashCid(cid) {
  return crypto.createHash('sha256')
    .update(CID_HASH_SALT + cid)
    .digest('hex')
    .toUpperCase();
}

/**
 * 管理员登录
 * POST /api/admin/login
 */
async function login(req, res) {
  try {
    const { username, password, cid_hash } = req.body;

    // 新版登录：用户名+密码
    if (username && password) {
      // 获取数据库实例
      const db = dbManager.getDb();
      const adminModel = new AdminModel(db);

      // 查询管理员
      const admin = adminModel.getAdminByUsername(username);

      if (!admin || !admin.password_hash) {
        logger.warn(`❌ 管理员登录失败: ${username} - 用户名或密码错误`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误'
        });
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, admin.password_hash);

      if (!passwordMatch) {
        logger.warn(`❌ 管理员登录失败: ${username} - 密码错误`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误'
        });
      }

      // 生成 JWT Token
      const token = generateToken(admin.username, admin.role, true);
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

      logger.info(`✅ 管理员登录成功: ${username}`);

      return res.json({
        success: true,
        token,
        expires_in: expiresIn,
        role: admin.role,
        username: admin.username,
        message: '登录成功'
      });
    }

    // 旧版登录：CID 哈希（兼容）
    if (cid_hash && cid_hash.length === 64) {
      const db = dbManager.getDb();
      const adminModel = new AdminModel(db);
      const admin = adminModel.getAdmin(cid_hash);

      if (!admin) {
        logger.warn(`❌ 管理员登录失败: ${cid_hash} - 非管理员`);
        return res.status(403).json({
          success: false,
          error: 'Not an admin',
          message: '您不是管理员'
        });
      }

      const token = generateToken(admin.cid_hash, admin.role, false);
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

      logger.info(`✅ 管理员登录成功（旧版）: ${cid_hash}`);

      return res.json({
        success: true,
        token,
        expires_in: expiresIn,
        role: admin.role,
        message: '登录成功'
      });
    }

    // 参数错误
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      message: '请提供用户名和密码'
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

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';
    logger.info(`✅ 统计数据查询成功: ${adminIdentifier}`);

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
 * 支持两种方式：
 * 1. 新版：传入明文 cid，后端自动计算哈希
 * 2. 旧版：传入 cid_hash（兼容）
 */
async function addWhitelist(req, res) {
  try {
    const { cid, cid_hash, note, expires_at } = req.body;

    let finalCid = null;
    let finalCidHash = null;

    // 优先使用明文 CID
    if (cid) {
      // 验证 CID 格式（应该是数字字符串）
      if (!/^\d+$/.test(cid)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid cid',
          message: '无效的 CID 格式，应为数字'
        });
      }

      finalCid = cid;
      finalCidHash = hashCid(cid);
    } else if (cid_hash && cid_hash.length === 64) {
      // 兼容旧版：只有哈希
      finalCidHash = cid_hash.toUpperCase();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: '请提供 CID 或 CID 哈希'
      });
    }

    const normalizedHash = hash.toUpperCase();

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';

    // 调试日志：输出即将插入的数据
    logger.debug(`准备添加白名单: CID=${finalCid}, Hash=${finalCidHash}, Note=${note}`);

    const success = whitelistModel.addToWhitelist({
      cid: finalCid,
      cidHash: finalCidHash,
      note: note || '',
      addedBy: adminIdentifier,
      expiresAt: expires_at || null
    });

    if (success) {
      logger.info(`✅ 添加白名单成功: CID=${finalCid}, Hash=${finalCidHash}, By=${adminIdentifier}`);
      res.json({
        success: true,
        message: '已添加到白名单',
        cid: finalCid,
        cid_hash: finalCidHash
      });
    } else {
      logger.warn(`⚠️ 添加白名单失败: ${finalCid || finalCidHash} - 已存在`);
      res.status(409).json({
        success: false,
        error: 'Already exists',
        message: '白名单已有该角色'
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

    const normalizedHash = hash.toUpperCase();

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);
    const success = whitelistModel.removeFromWhitelist(normalizedHash);

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';

    if (success) {
      logger.info(`✅ 移除白名单成功: ${normalizedHash} by ${adminIdentifier}`);
      res.json({
        success: true,
        message: '已从白名单移除'
      });
    } else {
      logger.warn(`⚠️ 移除白名单失败: ${normalizedHash} - 不存在`);
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
 * 更新白名单
 * PUT /api/admin/whitelist/:hash
 */
async function updateWhitelist(req, res) {
  try {
    const { hash } = req.params;
    const { cid, note, expires_at, authorized } = req.body;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hash',
        message: '无效的哈希值'
      });
    }

    const normalizedHash = hash.toUpperCase();

    let normalizedCid;
    let newCidHash;

    if (typeof cid === 'string') {
      const trimmedCid = cid.trim();
      if (trimmedCid) {
        if (!/^\d+$/.test(trimmedCid)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid cid',
            message: 'CID 必须是数字'
          });
        }
        normalizedCid = trimmedCid;
        newCidHash = hashCid(trimmedCid);
      } else {
        normalizedCid = null;
        newCidHash = null;
      }
    }

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    try {
      const success = whitelistModel.updateWhitelist(normalizedHash, {
        cid: normalizedCid,
        cidHash: newCidHash,
        note: typeof note === 'string' ? note : undefined,
        expiresAt: expires_at,
        authorized
      });

      if (success) {
        logger.info(`✅ 更新白名单成功: ${normalizedHash}`);
        return res.json({
          success: true,
          message: '白名单已更新',
          cid: normalizedCid,
          cid_hash: newCidHash || normalizedHash
        });
      }

      logger.warn(`⚠️ 更新白名单失败: ${normalizedHash} - 未找到条目`);
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: '未找到对应的白名单条目'
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        logger.warn(`⚠️ 更新白名单失败: ${normalizedHash} - CID 冲突`);
        return res.status(409).json({
          success: false,
          error: 'Already exists',
          message: '白名单已有该角色'
        });
      }
      throw error;
    }

  } catch (error) {
    logger.error(`❌ 更新白名单失败: ${error.message}`);
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

    // 调试日志：检查 qq_info 字段
    if (users.length > 0) {
      logger.debug(`第一个用户数据: CID=${users[0].cid}, QQ=${users[0].qq_info}, 角色=${users[0].character_name}`);
    }

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
  updateWhitelist,
  getUsers,
  getAllWhitelist,
  getLogs
};
