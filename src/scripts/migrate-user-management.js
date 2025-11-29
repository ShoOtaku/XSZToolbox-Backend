/**
 * 用户管理系统迁移脚本
 * 为 admins 表添加用户管理相关字段，创建 login_attempts 表
 */

require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 获取数据库路径（与应用保持一致）
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/xsztoolbox.db');

function migrateUserManagement() {
    console.log('开始用户管理系统迁移...');
    console.log(`目标数据库: ${dbPath}`);

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);

    try {
        // 启用WAL模式
        db.pragma('journal_mode = WAL');

        // 检查 admins 表是否存在
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'").all();
        
        if (tables.length === 0) {
            throw new Error('admins 表不存在，请先执行 initDatabase.js 初始化数据库');
        }

        // 检查 admins 表的字段
        const adminTableInfo = db.prepare('PRAGMA table_info(admins)').all();
        const existingColumns = adminTableInfo.map(col => col.name);

        console.log('当前 admins 表字段:', existingColumns.join(', '));

        // 添加缺失的字段
        const fieldsToAdd = [
            { name: 'last_login', sql: 'ALTER TABLE admins ADD COLUMN last_login DATETIME' },
            { name: 'login_count', sql: 'ALTER TABLE admins ADD COLUMN login_count INTEGER DEFAULT 0' },
            { name: 'created_by', sql: 'ALTER TABLE admins ADD COLUMN created_by TEXT' }
        ];

        let fieldsAdded = 0;
        for (const field of fieldsToAdd) {
            if (!existingColumns.includes(field.name)) {
                console.log(`添加 ${field.name} 字段...`);
                db.exec(field.sql);
                fieldsAdded++;
            } else {
                console.log(`✓ ${field.name} 字段已存在`);
            }
        }

        // 创建 login_attempts 表
        const loginAttemptsExists = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='login_attempts'"
        ).get();

        if (!loginAttemptsExists) {
            console.log('创建 login_attempts 表...');
            db.exec(`
                CREATE TABLE login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    success INTEGER DEFAULT 0
                )
            `);

            console.log('创建 login_attempts 索引...');
            db.exec('CREATE INDEX idx_login_attempts_username ON login_attempts(username)');
            db.exec('CREATE INDEX idx_login_attempts_time ON login_attempts(attempt_time)');
            console.log('✓ login_attempts 表创建完成');
        } else {
            console.log('✓ login_attempts 表已存在');
        }

        // 创建 admins 表的 username 索引（如果不存在）
        const indexes = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='admins' AND name='idx_admins_username'"
        ).all();

        if (indexes.length === 0) {
            console.log('创建 admins username 索引...');
            db.exec('CREATE INDEX idx_admins_username ON admins(username)');
        } else {
            console.log('✓ admins username 索引已存在');
        }

        console.log('\n🎉 用户管理系统迁移完成！');
        console.log(`   - admins 表新增字段: ${fieldsAdded} 个`);
        console.log(`   - login_attempts 表: ${loginAttemptsExists ? '已存在' : '已创建'}`);

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        db.close();
    }
}

// 执行迁移
if (require.main === module) {
    migrateUserManagement();
}

module.exports = { migrateUserManagement };
