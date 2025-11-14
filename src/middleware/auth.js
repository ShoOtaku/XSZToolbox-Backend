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
    const isAdmin = adminModel.isAdmin(decoded.cidHash);

    if (!isAdmin) {
      logger.warn(`❌ JWT 验证失败: 非管理员 - ${decoded.cidHash}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: '无管理员权限'
      });
    }

    // 将解码后的信息附加到 request 对象
    req.admin = {
      cidHash: decoded.cidHash,
      role: decoded.role
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
 * 生成 JWT Token
 * @param {string} cidHash - CID 哈希
 * @param {string} role - 角色
 * @returns {string} JWT Token
 */
function generateToken(cidHash, role = 'admin') {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  const payload = {
    cidHash,
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = {
  verifyToken,
  generateToken
};
