/**
 * XSZToolbox 后端服务 - 主入口文件
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const dbManager = require('./models/database');

// 导入中间件
const { requireHttps, configureCors, configureHelmet, verifySignature } = require('./middleware/security');
const { generalLimiter } = require('./middleware/rateLimit');
const { requestLogger } = require('./middleware/audit');

// 导入路由
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 中间件配置 ====================

// 1. 安全头（Helmet）
app.use(configureHelmet());

// 2. CORS 跨域配置
app.use(configureCors());

// 3. JSON 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. HTTP 请求日志
app.use(requestLogger);

// 5. HTTPS 强制检查
app.use(requireHttps);

// 6. 全局速率限制
if (process.env.ENABLE_RATE_LIMIT === 'true') {
  app.use(generalLimiter);
}

// 7. 请求签名验证（可选）
app.use(verifySignature);

// ==================== 静态文件服务 ====================

// 管理面板静态文件
const adminPanelPath = path.join(__dirname, '../admin-panel/dist');
app.use('/admin', express.static(adminPanelPath));

// ==================== API 路由 ====================

// 公共 API
app.use('/api', apiRoutes);

// 管理员 API
app.use('/api/admin', adminRoutes);

// ==================== 管理面板路由 ====================

// SPA 回退路由（管理面板）
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminPanelPath, 'index.html'));
});

// ==================== 根路径 ====================

app.get('/', (req, res) => {
  res.json({
    name: 'XSZToolbox Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      api: '/api',
      admin: '/admin',
      health: '/api/health'
    }
  });
});

// ==================== 404 处理 ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: '请求的资源不存在'
  });
});

// ==================== 错误处理 ====================

app.use((err, req, res, next) => {
  logger.error(`❌ 服务器错误: ${err.message}`);
  logger.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// ==================== 数据库初始化 ====================

async function initDatabase() {
  try {
    logger.info('📦 正在连接数据库...');
    dbManager.connect();

    logger.info('🔨 正在检查数据库表...');
    dbManager.initTables();

    logger.info('👤 正在同步管理员账户...');
    dbManager.initAdmins();

    logger.info('✅ 数据库初始化完成');
  } catch (error) {
    logger.error(`❌ 数据库初始化失败: ${error.message}`);
    process.exit(1);
  }
}

// ==================== 服务器启动 ====================

async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动服务器
    app.listen(PORT, () => {
      logger.info('========================================');
      logger.info(`  XSZToolbox 后端服务已启动`);
      logger.info('========================================');
      logger.info(`  端口: ${PORT}`);
      logger.info(`  环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`  HTTPS 强制: ${process.env.REQUIRE_HTTPS === 'true' ? '✅ 开启' : '❌ 关闭'}`);
      logger.info(`  速率限制: ${process.env.ENABLE_RATE_LIMIT === 'true' ? '✅ 开启' : '❌ 关闭'}`);
      logger.info('========================================');
      logger.info(`  访问地址: http://localhost:${PORT}`);
      logger.info(`  API 文档: http://localhost:${PORT}/api`);
      logger.info(`  管理面板: http://localhost:${PORT}/admin`);
      logger.info('========================================\n');
    });

  } catch (error) {
    logger.error(`❌ 服务器启动失败: ${error.message}`);
    process.exit(1);
  }
}

// ==================== 优雅关闭 ====================

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('\n收到 SIGINT 信号，正在关闭服务器...');
  dbManager.close();
  process.exit(0);
});

// ==================== 未捕获异常处理 ====================

process.on('uncaughtException', (error) => {
  logger.error(`❌ 未捕获的异常: ${error.message}`);
  logger.error(error.stack);
  dbManager.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`❌ 未处理的 Promise 拒绝: ${reason}`);
  logger.error(promise);
});

// 启动服务器
startServer();

module.exports = app;
