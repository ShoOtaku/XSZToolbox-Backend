/**
 * 管理员控制器
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const AdminModel = require('../models/adminModel');
const UserModel = require('../models/userModel');
const WhitelistModel = require('../models/whitelistModel');
const AuditLogModel = require('../models/auditLogModel');
const RoomModel = require('../models/roomModel');
const dbManager = require('../models/database');
const logger = require('../utils/logger');
const websocketService = require('../services/websocketService');
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
/**
 * 管理员登录
 * POST /api/admin/login
 */
async function login(req, res) {
  try {
    const { username, password, cid_hash } = req.body;

    // 获取客户端 IP 地址
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // 新版登录：用户名+密码
    if (username && password) {
      // 获取数据库实例
      const db = dbManager.getDb();
      const adminModel = new AdminModel(db);
      const auditLogModel = new AuditLogModel(db);

      // 查询管理员
      const admin = adminModel.getAdminByUsername(username);

      if (!admin || !admin.password_hash) {
        // 记录登录失败
        if (admin) {
          adminModel.recordLoginAttempt(username, ipAddress, false);
        }
        
        // 记录审计日志（登录失败）
        auditLogModel.addLog({
          action: 'login_failed',
          operator: username,
          target: username,
          details: JSON.stringify({ reason: '用户名或密码错误', ip_address: ipAddress }),
          ip_address: ipAddress
        });
        
        logger.warn(`❌ 管理员登录失败: ${username} from ${ipAddress} - 用户名或密码错误`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误'
        });
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, admin.password_hash);

      if (!passwordMatch) {
        // 记录登录失败
        adminModel.recordLoginAttempt(username, ipAddress, false);
        
        // 记录审计日志（登录失败）
        auditLogModel.addLog({
          action: 'login_failed',
          operator: username,
          target: username,
          details: JSON.stringify({ reason: '密码错误', ip_address: ipAddress }),
          ip_address: ipAddress
        });
        
        logger.warn(`❌ 管理员登录失败: ${username} from ${ipAddress} - 密码错误`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误'
        });
      }

      // 登录成功：更新登录信息
      adminModel.updateLoginInfo(username);
      
      // 清除失败登录记录
      adminModel.clearLoginAttempts(username, ipAddress);
      
      // 记录成功的登录尝试
      adminModel.recordLoginAttempt(username, ipAddress, true);

      // 记录审计日志（登录成功）
      auditLogModel.addLog({
        action: 'login_success',
        operator: username,
        target: username,
        details: JSON.stringify({ role: admin.role, ip_address: ipAddress }),
        ip_address: ipAddress
      });

      // 生成 JWT Token（包含角色信息）
      const token = generateToken(admin.username, admin.role, true);
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

      logger.info(`✅ 管理员登录成功: ${username} (${admin.role}) from ${ipAddress}`);

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
      const auditLogModel = new AuditLogModel(db);
      const admin = adminModel.getAdmin(cid_hash);

      if (!admin) {
        // 记录审计日志（登录失败）
        auditLogModel.addLog({
          action: 'login_failed',
          operator: cid_hash.substring(0, 8) + '...',
          target: cid_hash.substring(0, 8) + '...',
          details: JSON.stringify({ reason: '非管理员', ip_address: ipAddress }),
          ip_address: ipAddress
        });
        
        logger.warn(`❌ 管理员登录失败: ${cid_hash} from ${ipAddress} - 非管理员`);
        return res.status(403).json({
          success: false,
          error: 'Not an admin',
          message: '您不是管理员'
        });
      }

      // 记录审计日志（登录成功）
      auditLogModel.addLog({
        action: 'login_success',
        operator: cid_hash.substring(0, 8) + '...',
        target: cid_hash.substring(0, 8) + '...',
        details: JSON.stringify({ role: admin.role, ip_address: ipAddress, method: 'cid_hash' }),
        ip_address: ipAddress
      });

      const token = generateToken(admin.cid_hash, admin.role, false);
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

      logger.info(`✅ 管理员登录成功（旧版）: ${cid_hash} from ${ipAddress}`);

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

    const normalizedHash = finalCidHash ? finalCidHash.toUpperCase() : null;

    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';

    // 调试日志：输出即将插入的数据
    logger.debug(`准备添加白名单: CID=${finalCid}, Hash=${normalizedHash}, Note=${note}`);

    const success = whitelistModel.addToWhitelist({
      cid: finalCid,
      cidHash: normalizedHash,
      note: note || '',
      addedBy: adminIdentifier,
      expiresAt: expires_at || null
    });

    if (success) {
      logger.info(`✅ 添加白名单成功: CID=${finalCid}, Hash=${normalizedHash}, By=${adminIdentifier}`);
      res.json({
        success: true,
        message: '已添加到白名单',
        cid: finalCid,
        cid_hash: normalizedHash
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
    const {
      limit = 100,
      offset = 0,
      searchType,
      characterName,
      cid,
      worldName
    } = req.query;

    const db = dbManager.getDb();
    const userModel = new UserModel(db);

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    let users;
    let total;

    if (searchType === 'name' && characterName) {
      // 通过角色名查询 CID
      users = userModel.findByCharacterName(characterName, worldName);
      total = users.length;
    } else if (searchType === 'cid' && cid) {
      // 通过 CID 查询角色名
      users = userModel.findByCid(cid);
      total = users.length;
    } else {
      users = userModel.getAllUsers(parsedLimit, parsedOffset);
      total = userModel.getUserCount();
    }

    // 调试日志：检查 qq_info 字段
    if (users.length > 0) {
      logger.debug(`第一个用户数据: CID=${users[0].cid}, QQ=${users[0].qq_info}, 角色=${users[0].character_name}`);
    }

    logger.info(`✅ 用户列表查询成功: ${users.length} 条记录`);

    res.json({
      success: true,
      users,
      total,
      limit: parsedLimit,
      offset: parsedOffset
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

/**
 * 获取所有房间列表（管理员用）
 * GET /api/admin/rooms?status=active|closed|all
 */
async function getAllRooms(req, res) {
  try {
    const { status = 'active', limit = 100, offset = 0 } = req.query;

    // 验证 status 参数
    const validStatuses = ['active', 'closed', 'all'];
    const normalizedStatus = validStatuses.includes(status) ? status : 'active';

    const rooms = RoomModel.getAllRooms(normalizedStatus, parseInt(limit), parseInt(offset));
    const total = RoomModel.getRoomCount(normalizedStatus);

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';
    logger.info(`✅ 房间列表查询成功: ${rooms.length} 条记录, status=${normalizedStatus}, by ${adminIdentifier}`);

    res.json({
      success: true,
      rooms,
      total,
      status: normalizedStatus,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error(`❌ 房间列表查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取房间成员详情
 * GET /api/admin/rooms/:roomId/members
 */
async function getRoomMembers(req, res) {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: '缺少房间 ID'
      });
    }

    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: '房间不存在'
      });
    }

    const members = RoomModel.getRoomMembers(room.id);

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';
    logger.info(`✅ 房间成员查询成功: 房间=${room.room_code}, 成员数=${members.length}, by ${adminIdentifier}`);

    res.json({
      success: true,
      room,
      members
    });

  } catch (error) {
    logger.error(`❌ 房间成员查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 管理员强制关闭房间
 * DELETE /api/admin/rooms/:roomId
 */
async function adminCloseRoom(req, res) {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: '缺少房间 ID'
      });
    }

    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: '房间不存在'
      });
    }

    if (room.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Already closed',
        message: '房间已关闭'
      });
    }

    RoomModel.closeRoom(parseInt(roomId));

    const adminIdentifier = req.admin.username || req.admin.cidHash || 'admin';
    logger.info(`✅ 管理员关闭房间: ${room.room_code} (ID: ${roomId}), by ${adminIdentifier}`);

    res.json({
      success: true,
      message: '房间已关闭',
      roomCode: room.room_code
    });

  } catch (error) {
    logger.error(`❌ 关闭房间失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}


// ==================== 用户管理 API ====================

/**
 * 获取用户列表
 * GET /api/admin/users/list
 */
async function getUserList(req, res) {
  try {
    const { limit = 50, offset = 0, role } = req.query;

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 获取用户列表
    const result = adminModel.getAllUsers({
      limit: parseInt(limit),
      offset: parseInt(offset),
      role: role || undefined
    });

    // 移除敏感信息（密码哈希）
    const users = result.users.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      last_login: user.last_login,
      login_count: user.login_count || 0,
      created_at: user.created_at,
      created_by: user.created_by
    }));

    logger.info(`✅ 获取用户列表成功: ${users.length} 条记录, by ${req.admin.username}`);

    res.json({
      success: true,
      users,
      total: result.total
    });

  } catch (error) {
    logger.error(`❌ 获取用户列表失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 创建用户
 * POST /api/admin/users/create
 */
async function createUser(req, res) {
  try {
    const { username, password, role = 'viewer' } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少必填字段：用户名和密码'
      });
    }

    // 验证用户名格式（只允许字母、数字、下划线）
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username',
        message: '用户名格式错误（3-20个字符，只允许字母、数字、下划线）'
      });
    }

    // 验证密码强度
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: '密码长度至少为 8 个字符'
      });
    }

    // 验证角色
    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: '角色必须为 admin 或 viewer'
      });
    }

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 检查用户名是否已存在
    const existingUser = adminModel.getAdminByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username exists',
        message: '用户名已存在'
      });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const userId = adminModel.createUser({
      username,
      passwordHash,
      role,
      createdBy: req.admin.username
    });

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: 'user_create',
      operator: req.admin.username,
      target: username,
      details: JSON.stringify({ role, created_by: req.admin.username }),
      ip_address: req.ip
    });

    logger.info(`✅ 创建用户成功: ${username} (${role}), by ${req.admin.username}`);

    res.json({
      success: true,
      message: '用户创建成功',
      user: {
        id: userId,
        username,
        role
      }
    });

  } catch (error) {
    logger.error(`❌ 创建用户失败: ${error.message}`);
    
    if (error.message === '用户名已存在') {
      return res.status(409).json({
        success: false,
        error: 'Username exists',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 更新用户
 * PUT /api/admin/users/:id
 */
async function updateUser(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const { username, role, password } = req.body;

    // 验证至少有一个字段需要更新
    if (!username && !role && !password) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        message: '没有需要更新的字段'
      });
    }

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 获取目标用户信息
    const targetUser = adminModel.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: '用户不存在'
      });
    }

    // 验证用户名格式（如果提供）
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username',
        message: '用户名格式错误（3-20个字符，只允许字母、数字、下划线）'
      });
    }

    // 验证角色（如果提供）
    if (role && !['admin', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: '角色必须为 admin 或 viewer'
      });
    }

    // 验证密码强度（如果提供）
    if (password && password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: '密码长度至少为 8 个字符'
      });
    }

    // 检查新用户名是否已存在（如果修改用户名）
    if (username && username !== targetUser.username) {
      const existingUser = adminModel.getAdminByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Username exists',
          message: '用户名已存在'
        });
      }
    }

    // 准备更新数据
    const updates = {};
    if (username) updates.username = username;
    if (role) updates.role = role;
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    // 记录修改前的值
    const oldValues = {
      username: targetUser.username,
      role: targetUser.role
    };

    // 更新用户
    const success = adminModel.updateUser(userId, updates);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Update failed',
        message: '更新失败'
      });
    }

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: 'user_update',
      operator: req.admin.username,
      target: targetUser.username,
      details: JSON.stringify({
        old: oldValues,
        new: { username, role, password_changed: !!password }
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 更新用户成功: ${targetUser.username} -> ${username || targetUser.username}, by ${req.admin.username}`);

    res.json({
      success: true,
      message: '用户信息已更新'
    });

  } catch (error) {
    logger.error(`❌ 更新用户失败: ${error.message}`);
    
    if (error.message === '用户名已存在') {
      return res.status(409).json({
        success: false,
        error: 'Username exists',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 */
async function deleteUser(req, res) {
  try {
    const userId = parseInt(req.params.id);

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 获取目标用户信息
    const targetUser = adminModel.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: '用户不存在'
      });
    }

    // 防止删除自己的账号
    if (targetUser.username === req.admin.username) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete self',
        message: '不能删除自己的账号'
      });
    }

    // 删除用户
    const success = adminModel.deleteUser(userId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Delete failed',
        message: '删除失败'
      });
    }

    // 记录审计日志（包含被删除用户的完整信息）
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: 'user_delete',
      operator: req.admin.username,
      target: targetUser.username,
      details: JSON.stringify({
        deleted_user: {
          id: targetUser.id,
          username: targetUser.username,
          role: targetUser.role,
          created_at: targetUser.created_at,
          created_by: targetUser.created_by
        }
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 删除用户成功: ${targetUser.username}, by ${req.admin.username}`);

    res.json({
      success: true,
      message: '用户已删除'
    });

  } catch (error) {
    logger.error(`❌ 删除用户失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}


// ==================== 账号管理 ====================

/**
 * 修改密码
 * POST /api/admin/account/change-password
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    // 验证必填字段
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少必填字段：当前密码和新密码'
      });
    }

    // 验证新密码强度
    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: '新密码长度至少为 8 个字符'
      });
    }

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 获取当前用户信息
    const currentUser = adminModel.getAdminByUsername(req.admin.username);
    if (!currentUser || !currentUser.password_hash) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: '用户不存在或未设置密码'
      });
    }

    // 验证当前密码
    const passwordMatch = await bcrypt.compare(current_password, currentUser.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        message: '当前密码错误'
      });
    }

    // 哈希新密码
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // 更新密码
    const success = adminModel.updateUser(currentUser.id, {
      passwordHash: newPasswordHash
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Update failed',
        message: '密码更新失败'
      });
    }

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: 'password_change',
      operator: req.admin.username,
      target: req.admin.username,
      details: JSON.stringify({ changed_by_self: true }),
      ip_address: req.ip
    });

    logger.info(`✅ 修改密码成功: ${req.admin.username}`);

    res.json({
      success: true,
      message: '密码修改成功，请重新登录'
    });

  } catch (error) {
    logger.error(`❌ 修改密码失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 修改用户名
 * PUT /api/admin/account/change-username
 */
async function changeUsername(req, res) {
  try {
    const { new_username, password } = req.body;

    // 验证必填字段
    if (!new_username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少必填字段：新用户名和密码'
      });
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(new_username)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username',
        message: '用户名格式错误（3-20个字符，只允许字母、数字、下划线）'
      });
    }

    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 获取当前用户信息
    const currentUser = adminModel.getAdminByUsername(req.admin.username);
    if (!currentUser || !currentUser.password_hash) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: '用户不存在或未设置密码'
      });
    }

    // 验证密码
    const passwordMatch = await bcrypt.compare(password, currentUser.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        message: '密码错误'
      });
    }

    // 检查新用户名是否已存在
    const existingUser = adminModel.getAdminByUsername(new_username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username exists',
        message: '用户名已存在'
      });
    }

    // 记录旧用户名
    const oldUsername = currentUser.username;

    // 更新用户名
    const success = adminModel.updateUser(currentUser.id, {
      username: new_username
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Update failed',
        message: '用户名更新失败'
      });
    }

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: 'username_change',
      operator: oldUsername,
      target: new_username,
      details: JSON.stringify({
        old_username: oldUsername,
        new_username: new_username
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 修改用户名成功: ${oldUsername} -> ${new_username}`);

    res.json({
      success: true,
      message: '用户名修改成功，请重新登录'
    });

  } catch (error) {
    logger.error(`❌ 修改用户名失败: ${error.message}`);
    
    if (error.message === '用户名已存在') {
      return res.status(409).json({
        success: false,
        error: 'Username exists',
        message: error.message
      });
    }

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
  getLogs,
  // 房间管理
  getAllRooms,
  getRoomMembers,
  adminCloseRoom,
  updateMemberJobRole,
  updateMemberRole,
  sendRoomCommand,
  getRoomCommandHistory,
  // 用户管理
  getUserList,
  createUser,
  updateUser,
  deleteUser,
  // 账号管理
  changePassword,
  changeUsername
};

// ==================== 房间成员管理 API ====================

/**
 * 更新成员职能标识
 * PUT /api/admin/room/:roomId/member/:cidHash/job
 */
async function updateMemberJobRole(req, res) {
  try {
    const dbManager = require('../models/database');
    const db = dbManager.getDb();
    const { roomId, cidHash } = req.params;
    const { jobRole } = req.body;

    // 参数验证
    const validJobRoles = ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4", null];
    if (jobRole !== null && !validJobRoles.includes(jobRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid job role",
        message: "无效的职能标识"
      });
    }

    // 验证房间存在
    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
        message: "房间不存在"
      });
    }

    // 验证成员存在
    const member = RoomModel.getMember(parseInt(roomId), cidHash);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
        message: "成员不存在"
      });
    }

    // 更新职能标识
    RoomModel.updateMemberJobRole(parseInt(roomId), cidHash, jobRole);

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: "update_member_job_role",
      operator: req.admin.username,
      target: `Room ${roomId} - ${cidHash.substring(0, 8)}`,
      details: JSON.stringify({
        roomId: parseInt(roomId),
        cidHash,
        oldJobRole: member.job_role,
        newJobRole: jobRole
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 管理员 ${req.admin.username} 更新成员职能: Room ${roomId}, ${cidHash.substring(0, 8)} -> ${jobRole}`);

    // 广播给房间内所有成员
    try {
      const io = websocketService.io;
      if (io && room.room_code) {
        io.to(room.room_code).emit('member-updated', {
          cidHash,
          jobRole,
          type: 'job_role',
          timestamp: new Date().toISOString()
        });
        logger.info(`📡 已广播职能更新到房间 ${room.room_code}`);
      }
    } catch (broadcastError) {
      logger.error(`❌ 广播职能更新失败: ${broadcastError.message}`);
    }

    res.json({
      success: true,
      message: "职能已更新"
    });

  } catch (error) {
    logger.error(`❌ 更新成员职能失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "服务器错误"
    });
  }
}

/**
 * 更新成员权限角色
 * PUT /api/admin/room/:roomId/member/:cidHash/role
 */
async function updateMemberRole(req, res) {
  try {
    const dbManager = require('../models/database');
    const db = dbManager.getDb();
    const { roomId, cidHash } = req.params;
    const { role } = req.body;

    // 参数验证
    const validRoles = ["Leader", "Member"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
        message: "无效的权限角色"
      });
    }

    // 验证房间存在
    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
        message: "房间不存在"
      });
    }

    // 验证成员存在
    const member = RoomModel.getMember(parseInt(roomId), cidHash);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
        message: "成员不存在"
      });
    }

    // 不能修改房主权限
    if (room.host_cid_hash === cidHash) {
      return res.status(403).json({
        success: false,
        error: "Cannot modify host role",
        message: "不能修改房主权限"
      });
    }

    // 更新权限角色
    RoomModel.updateMemberRole(parseInt(roomId), cidHash, role);

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: "update_member_role",
      operator: req.admin.username,
      target: `Room ${roomId} - ${cidHash.substring(0, 8)}`,
      details: JSON.stringify({
        roomId: parseInt(roomId),
        cidHash,
        oldRole: member.role,
        newRole: role
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 管理员 ${req.admin.username} 更新成员权限: Room ${roomId}, ${cidHash.substring(0, 8)} -> ${role}`);

    // 广播给房间内所有成员
    try {
      const io = websocketService.io;
      if (io && room.room_code) {
        io.to(room.room_code).emit('member-updated', {
          cidHash,
          role,
          type: 'role',
          timestamp: new Date().toISOString()
        });
        logger.info(`📡 已广播权限更新到房间 ${room.room_code}`);
      }
    } catch (broadcastError) {
      logger.error(`❌ 广播权限更新失败: ${broadcastError.message}`);
    }

    res.json({
      success: true,
      message: "权限已更新"
    });

  } catch (error) {
    logger.error(`❌ 更新成员权限失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "服务器错误"
    });
  }
}


/**
 * 发送房间指令
 * POST /api/admin/room/:roomId/command
 */
async function sendRoomCommand(req, res) {
  try {
    const dbManager = require('../models/database');
    const db = dbManager.getDb();
    const { roomId } = req.params;
    const { targetType, targetCidHash, commandType, commandParams } = req.body;

    // 参数验证
    if (!targetType || !['all', 'single'].includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid target type",
        message: "无效的目标类型"
      });
    }

    if (targetType === 'single' && !targetCidHash) {
      return res.status(400).json({
        success: false,
        error: "Target CID hash required",
        message: "单个目标时必须指定成员"
      });
    }

    if (!commandType) {
      return res.status(400).json({
        success: false,
        error: "Command type required",
        message: "指令类型不能为空"
      });
    }

    // 验证房间存在
    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
        message: "房间不存在"
      });
    }

    // 如果是单个目标，验证成员存在
    if (targetType === 'single') {
      const member = RoomModel.getMember(parseInt(roomId), targetCidHash);
      if (!member) {
        return res.status(404).json({
          success: false,
          error: "Member not found",
          message: "目标成员不存在"
        });
      }
    }

    // 保存指令记录
    const commandData = {
      roomId: parseInt(roomId),
      targetType,
      targetCidHash: targetType === 'single' ? targetCidHash : null,
      commandType,
      commandParams: JSON.stringify(commandParams),
      sentBy: req.admin.username
    };

    const result = RoomModel.createCommand(commandData);

    // 记录审计日志
    const auditLogModel = new AuditLogModel(db);
    auditLogModel.addLog({
      action: "send_room_command",
      operator: req.admin.username,
      target: `Room ${roomId}`,
      details: JSON.stringify({
        roomId: parseInt(roomId),
        targetType,
        targetCidHash,
        commandType,
        commandParams
      }),
      ip_address: req.ip
    });

    logger.info(`✅ 管理员 ${req.admin.username} 发送房间指令: Room ${roomId}, ${commandType} -> ${targetType}`);

    res.json({
      success: true,
      commandId: result.lastInsertRowid,
      message: "指令已发送"
    });

  } catch (error) {
    logger.error(`❌ 发送房间指令失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "服务器错误"
    });
  }
}

/**
 * 获取房间指令历史
 * GET /api/admin/room/:roomId/commands
 */
async function getRoomCommandHistory(req, res) {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // 验证房间存在
    const room = RoomModel.getRoomById(parseInt(roomId));
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
        message: "房间不存在"
      });
    }

    // 获取指令历史
    const commands = RoomModel.getCommandHistory(parseInt(roomId), limit);

    // 为每条指令添加目标成员名称
    const commandsWithNames = commands.map(cmd => {
      let targetName = "所有成员";
      if (cmd.target_type === 'single' && cmd.target_cid_hash) {
        const member = RoomModel.getMember(parseInt(roomId), cmd.target_cid_hash);
        if (member) {
          targetName = `${member.character_name}@${member.world_name}`;
        }
      }
      return {
        ...cmd,
        targetName
      };
    });

    res.json({
      success: true,
      commands: commandsWithNames
    });

  } catch (error) {
    logger.error(`❌ 获取指令历史失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "服务器错误"
    });
  }
}

