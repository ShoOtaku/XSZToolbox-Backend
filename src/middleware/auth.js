/**
 * JWT 认证中间件
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AdminModel = require('../models/adminModel');
const dbManager = require('../models/database');

/**
 * 验证 JWT Token
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    logger.warn(`❌ JWT 验证失败: 缺少 Authorization 头 - ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      message: '未提供认证令牌'
    });
  }

  // 提取 Bearer Token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn(`❌ JWT 验证失败: 格式错误 - ${authHeader}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid token format',
      message: '令牌格式错误'
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    logger.error('❌ JWT_SECRET 未配置');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      message: '服务器配置错误'
    });
  }

  try {
    // 验证 Token
    const decoded = jwt.verify(token, secret);

    // 检查是否为管理员
    const db = dbManager.getDb();
    const adminModel = new AdminModel(db);

    // 优先使用 username，兼容旧版的 cidHash
    let admin = null;
    if (decoded.username) {
      admin = adminModel.getAdminByUsername(decoded.username);
    } else if (decoded.cidHash) {
      // 兼容旧版 Token
      admin = adminModel.getAdmin(decoded.cidHash);
    }

    if (!admin) {
      logger.warn(`❌ JWT 验证失败: 非管理员 - ${decoded.username || decoded.cidHash}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '无管理员权限'
      });
    }

    // 将解码后的信息附加到 request 对象
    req.admin = {
      username: decoded.username || null,
      cidHash: decoded.cidHash || null,
      role: decoded.role || admin.role || 'admin'
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn(`❌ JWT 验证失败: 令牌已过期 - ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: '令牌已过期，请重新登录'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn(`❌ JWT 验证失败: 无效令牌 - ${error.message}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: '无效的令牌'
      });
    }

    logger.error(`❌ JWT 验证错误: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 生成 JWT Token（新版使用用户名）
 * @param {string} identifier - 用户名或 CID 哈希
 * @param {string} role - 角色
 * @param {boolean} isUsername - 是否为用户名（默认 true）
 * @returns {string} JWT Token
 */
function generateToken(identifier, role = 'admin', isUsername = true) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  const payload = {
    ...(isUsername ? { username: identifier } : { cidHash: identifier }),
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * 基于角色的访问控制中间件
 * @param {string|string[]} allowedRoles - 允许的角色（单个角色或角色数组）
 * @returns {Function} Express 中间件函数
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    // 确保用户已通过 verifyToken 中间件认证
    if (!req.admin || !req.admin.role) {
      logger.warn(`❌ 权限检查失败: 未找到用户信息 - ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '未认证'
      });
    }

    const userRole = req.admin.role;
    
    // 将单个角色转换为数组
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // 检查用户角色是否在允许列表中
    if (!roles.includes(userRole)) {
      logger.warn(`❌ 权限不足: ${req.admin.username || req.admin.cidHash} (${userRole}) 尝试访问 ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '权限不足'
      });
    }
    
    // 权限验证通过，继续处理请求
    next();
  };
}

module.exports = {
  verifyToken,
  generateToken,
  requireRole
};
