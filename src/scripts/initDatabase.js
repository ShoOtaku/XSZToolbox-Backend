/**
 * 数据库初始化脚本
 * 使用方法: npm run init-db
 */

require('dotenv').config();
const dbManager = require('../models/database');

console.log('========================================');
console.log('  XSZToolbox 数据库初始化');
console.log('========================================\n');

try {
  // 连接数据库
  console.log('📦 正在连接数据库...');
  dbManager.connect();

  // 初始化表结构
  console.log('\n🔨 正在创建数据库表...');
  dbManager.initTables();

  // 初始化管理员
  console.log('\n👤 正在初始化管理员账户...');
  dbManager.initAdmins();

  // 关闭连接
  console.log('\n🔒 正在关闭数据库连接...');
  dbManager.close();

  console.log('\n========================================');
  console.log('  ✅ 数据库初始化完成！');
  console.log('========================================\n');
  console.log('提示: 请使用 npm run dev 启动开发服务器\n');

} catch (error) {
  console.error('\n❌ 数据库初始化失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
