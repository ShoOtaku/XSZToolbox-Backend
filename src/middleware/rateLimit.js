/**
 * 速率限制中间件
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * 通用速率限制
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
  message: {
    success: false,
    error: 'Too many requests',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 开发环境跳过限制
    return process.env.NODE_ENV === 'development';
  },
  handler: (req, res) => {
    logger.warn(`⚠️ 速率限制触发: ${req.ip} - ${req.method} ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: '请求过于频繁，请稍后再试'
    });
  }
});

/**
 * 验证接口专用限制（更严格）
 */
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 20, // 最多 20 次
  message: {
    success: false,
    error: 'Too many requests',
    message: '验证请求过于频繁'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
  handler: (req, res) => {
    logger.warn(`⚠️ 验证速率限制触发: ${req.ip} - ${req.params.hash}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: '验证请求过于频繁，请稍后再试'
    });
  }
});

/**
 * 管理员登录限制（防止暴力破解）
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 最多 5 次
  message: {
    success: false,
    error: 'Too many login attempts',
    message: '登录尝试次数过多，请 15 分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计数
  handler: (req, res) => {
    logger.warn(`⚠️ 登录速率限制触发: ${req.ip} - ${req.body.cid_hash}`);
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: '登录尝试次数过多，请 15 分钟后再试'
    });
  }
});

module.exports = {
  generalLimiter,
  verifyLimiter,
  loginLimiter
};
