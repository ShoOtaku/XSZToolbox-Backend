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
        cid TEXT,
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
        cid TEXT,
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
        username TEXT UNIQUE,
        password_hash TEXT,
        cid_hash TEXT,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 数据库迁移：为现有表添加新列（如果不存在）
    this.migrateDatabase();

    // 创建索引提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_cid ON users(cid);
      CREATE INDEX IF NOT EXISTS idx_users_cid_hash ON users(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
      CREATE INDEX IF NOT EXISTS idx_whitelist_cid ON whitelist(cid);
      CREATE INDEX IF NOT EXISTS idx_whitelist_cid_hash ON whitelist(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_whitelist_expires_at ON whitelist(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_cid_hash ON audit_logs(cid_hash);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
    `);

    console.log('✅ 数据库表结构已初始化');
  }

  /**
   * 数据库迁移 - 为现有表添加新列
   */
  migrateDatabase() {
    console.log('🔄 正在检查数据库迁移...');

    // 迁移 users 表：添加 cid 列
    try {
      this.db.exec('ALTER TABLE users ADD COLUMN cid TEXT');
      console.log('  ✅ users 表已添加 cid 列');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('  ℹ️ users.cid 列已存在');
      } else {
        console.log('  ⚠️ users 表迁移失败:', error.message);
      }
    }

    // 迁移 whitelist 表：添加 cid 列
    try {
      this.db.exec('ALTER TABLE whitelist ADD COLUMN cid TEXT');
      console.log('  ✅ whitelist 表已添加 cid 列');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('  ℹ️ whitelist.cid 列已存在');
      } else {
        console.log('  ⚠️ whitelist 表迁移失败:', error.message);
      }
    }

    // 迁移 admins 表：添加 username 和 password_hash 列
    try {
      this.db.exec('ALTER TABLE admins ADD COLUMN username TEXT');
      console.log('  ✅ admins 表已添加 username 列');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('  ℹ️ admins.username 列已存在');
      } else {
        console.log('  ⚠️ admins.username 迁移失败:', error.message);
      }
    }

    try {
      this.db.exec('ALTER TABLE admins ADD COLUMN password_hash TEXT');
      console.log('  ✅ admins 表已添加 password_hash 列');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('  ℹ️ admins.password_hash 列已存在');
      } else {
        console.log('  ⚠️ admins.password_hash 迁移失败:', error.message);
      }
    }

    console.log('✅ 数据库迁移完成');
  }

  /**
   * 初始化管理员账户
   * 新版：创建用户名/密码管理员
   * 兼容旧版：支持通过 CID 哈希创建管理员
   */
  initAdmins() {
    const bcrypt = require('bcrypt');
    const SALT_ROUNDS = 10;

    // 创建默认管理员账户（admin / admin123）
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

    try {
      // 检查是否已存在该用户名
      const existing = this.db.prepare('SELECT id FROM admins WHERE username = ?').get(defaultUsername);

      if (!existing) {
        // 生成密码哈希
        const passwordHash = bcrypt.hashSync(defaultPassword, SALT_ROUNDS);

        // 插入默认管理员
        this.db.prepare(`
          INSERT INTO admins (username, password_hash, role)
          VALUES (?, ?, 'admin')
        `).run(defaultUsername, passwordHash);

        console.log(`✅ 已创建默认管理员账户: ${defaultUsername}`);
        console.log(`   默认密码: ${defaultPassword}`);
        console.log(`   ⚠️ 请登录后立即修改密码！`);
      } else {
        console.log(`ℹ️ 管理员账户 ${defaultUsername} 已存在`);
      }
    } catch (error) {
      console.error(`❌ 创建管理员账户失败: ${error.message}`);
    }

    // 兼容旧版：支持通过环境变量配置 CID 哈希管理员
    const adminHashes = (process.env.ADMIN_CID_HASHES || '').split(',').filter(Boolean);
    if (adminHashes.length > 0) {
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
      console.log(`✅ 已初始化 ${adminHashes.length} 个 CID 哈希管理员（兼容模式）`);
    }
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
