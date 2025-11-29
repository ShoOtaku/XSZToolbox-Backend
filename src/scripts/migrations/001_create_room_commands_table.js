/**
 * 数据库迁移脚本 - 创建 remote_room_commands 表
 * 用于存储房间指令历史记录
 * 
 * 使用方法: node src/scripts/migrations/001_create_room_commands_table.js
 */

require('dotenv').config();
const dbManager = require('../../models/database');

console.log('========================================');
console.log('  数据库迁移: 创建 remote_room_commands 表');
console.log('========================================\n');

try {
  // 连接数据库
  console.log('📦 正在连接数据库...');
  dbManager.connect();
  const db = dbManager.getDb();

  // 检查表是否已存在
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='remote_room_commands'
  `).get();

  if (tableExists) {
    console.log('ℹ️  表 remote_room_commands 已存在，跳过创建');
  } else {
    console.log('\n🔨 正在创建 remote_room_commands 表...');
    
    // 创建表
    db.exec(`
      CREATE TABLE remote_room_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('all', 'single')),
        target_cid_hash TEXT,
        command_type TEXT NOT NULL,
        command_params TEXT,
        status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'failed')),
        sent_by TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        FOREIGN KEY (room_id) REFERENCES remote_rooms(id) ON DELETE CASCADE
      );
    `);
    
    console.log('✅ 表 remote_room_commands 创建成功');
  }

  // 创建索引
  console.log('\n🔨 正在创建索引...');
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_room_commands_room_id 
    ON remote_room_commands(room_id);
  `);
  console.log('✅ 索引 idx_room_commands_room_id 创建成功');
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_room_commands_sent_at 
    ON remote_room_commands(sent_at DESC);
  `);
  console.log('✅ 索引 idx_room_commands_sent_at 创建成功');

  // 验证表结构
  console.log('\n🔍 验证表结构...');
  const tableInfo = db.pragma('table_info(remote_room_commands)');
  console.log('表字段:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? ', DEFAULT ' + col.dflt_value : ''})`);
  });

  // 验证索引
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND tbl_name='remote_room_commands'
  `).all();
  console.log('\n表索引:');
  indexes.forEach(idx => {
    console.log(`  - ${idx.name}`);
  });

  // 关闭连接
  console.log('\n🔒 正在关闭数据库连接...');
  dbManager.close();

  console.log('\n========================================');
  console.log('  ✅ 迁移完成！');
  console.log('========================================\n');

} catch (error) {
  console.error('\n❌ 迁移失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
