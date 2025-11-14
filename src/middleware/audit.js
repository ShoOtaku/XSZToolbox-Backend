/**
 * 审计日志中间件
 */

const logger = require('../utils/logger');
const AuditLogModel = require('../models/auditLogModel');
const dbManager = require('../models/database');

/**
 * HTTP 请求日志中间件
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
}

/**
 * 审计日志记录中间件（异步）
 */
function auditLog(action) {
  return async (req, res, next) => {
    // 保存原始 json 方法
    const originalJson = res.json.bind(res);

    // 重写 json 方法以记录审计日志
    res.json = function (data) {
      // 仅在成功时记录
      if (data.success !== false) {
        try {
          const db = dbManager.getDb();
          const auditLogModel = new AuditLogModel(db);

          const logData = {
            cidHash: req.body?.cid || req.params?.hash || req.admin?.cidHash || null,
            action: action,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            details: {
              method: req.method,
              url: req.originalUrl,
              body: req.body,
              params: req.params
            }
          };

          auditLogModel.log(logData);
        } catch (error) {
          logger.error(`审计日志记录失败: ${error.message}`);
        }
      }

      // 调用原始 json 方法
      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  requestLogger,
  auditLog
};
