/**
 * 安全中间件
 */

const helmet = require('helmet');
const cors = require('cors');
const logger = require('../utils/logger');

/**
 * HTTPS 强制中间件
 */
function requireHttps(req, res, next) {
  // 检查是否启用 HTTPS 强制
  if (process.env.REQUIRE_HTTPS !== 'true') {
    return next();
  }

  // 开发环境跳过检查
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // 检查请求协议
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  if (!isHttps) {
    logger.warn(`❌ HTTPS 强制: 拒绝 HTTP 请求 - ${req.method} ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      error: 'HTTPS required',
      message: '此服务仅支持 HTTPS 连接'
    });
  }

  next();
}

/**
 * 配置 CORS
 */
function configureCors() {
  const origin = process.env.CORS_ORIGIN || '*';

  return cors({
    origin: origin === '*' ? '*' : origin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Timestamp', 'X-Signature'],
    credentials: true,
    maxAge: 86400 // 24 小时
  });
}

/**
 * 配置 Helmet 安全头
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
}

/**
 * 请求签名验证中间件（可选）
 */
function verifySignature(req, res, next) {
  // 如果没有配置 HMAC 密钥，跳过验证
  if (!process.env.HMAC_SECRET) {
    return next();
  }

  // 仅验证 POST 请求
  if (req.method !== 'POST') {
    return next();
  }

  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  // 如果没有签名头，跳过验证（向后兼容）
  if (!timestamp || !signature) {
    return next();
  }

  // 验证时间戳（防止重放攻击）
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);

  if (Math.abs(now - requestTime) > 60) {
    logger.warn(`❌ 请求签名验证失败: 时间戳过期 - ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'Request expired',
      message: '请求已过期'
    });
  }

  // 验证签名
  const crypto = require('../utils/crypto');
  const payload = JSON.stringify(req.body) + timestamp;
  const isValid = crypto.verifyHMAC(payload, signature, process.env.HMAC_SECRET);

  if (!isValid) {
    logger.warn(`❌ 请求签名验证失败: 签名无效 - ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid signature',
      message: '签名无效'
    });
  }

  next();
}

module.exports = {
  requireHttps,
  configureCors,
  configureHelmet,
  verifySignature
};
