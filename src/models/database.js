/**
 * 数据库连接管理
 * 使用 better-sqlite3 提供同步 SQLite 操作
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  /**
   * 初始化数据库连接
   */
  connect() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/xsztoolbox.db');
    const dbDir = path.dirname(dbPath);

    // 确保数据库目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 创建数据库连接（启用 WAL 模式提高并发性能）
    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // 启用 WAL 模式
    this.db.pragma('journal_mode = WAL');
    // 启用外键约束
    this.db.pragma('foreign_keys = ON');

    console.log(`✅ 数据库已连接: ${dbPath}`);
    return this.db;
  }

  /**
   * 初始化数据库表结构
   */
  initTables() {
    if (!this.db) {
      throw new Error('数据库未连接，请先调用 connect()');
    }

    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid_hash TEXT UNIQUE NOT NULL,
        character_name TEXT,
        world_name TEXT,
        qq_info TEXT,
        first_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        login_count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 白名单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid_hash TEXT UNIQUE NOT NULL,
        note TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        added_by TEXT,
        expires_at DATETIME,
        authorized INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '["all"]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 审计日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid_hash TEXT,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 管理员表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid_hash TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建索引提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_cid_hash ON users(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
      CREATE INDEX IF NOT EXISTS idx_whitelist_cid_hash ON whitelist(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_whitelist_expires_at ON whitelist(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_cid_hash ON audit_logs(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    `);

    console.log('✅ 数据库表结构已初始化');
  }

  /**
   * 初始化管理员账户
   */
  initAdmins() {
    const adminHashes = (process.env.ADMIN_CID_HASHES || '').split(',').filter(Boolean);

    if (adminHashes.length === 0) {
      console.warn('⚠️ 未配置管理员 CID 哈希，请在 .env 中设置 ADMIN_CID_HASHES');
      return;
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO admins (cid_hash, role)
      VALUES (?, 'admin')
    `);

    const insertMany = this.db.transaction((hashes) => {
      for (const hash of hashes) {
        insertStmt.run(hash.trim());
      }
    });

    insertMany(adminHashes);
    console.log(`✅ 已初始化 ${adminHashes.length} 个管理员账户`);
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('✅ 数据库连接已关闭');
    }
  }

  /**
   * 获取数据库实例
   */
  getDb() {
    if (!this.db) {
      throw new Error('数据库未连接，请先调用 connect()');
    }
    return this.db;
  }
}

// 导出单例
const dbManager = new DatabaseManager();
module.exports = dbManager;
