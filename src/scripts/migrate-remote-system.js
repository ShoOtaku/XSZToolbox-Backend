/**
 * 遥控系统数据表迁移脚本
 * 创建 remote_rooms, remote_room_members, remote_commands 表
 */

require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 获取数据库路径
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/xsztoolbox.db');

function migrateRemoteSystem() {
    console.log('开始迁移遥控系统数据表...');
    console.log(`目标数据库: ${dbPath}`);

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);

    try {
        // 启用WAL模式（提升并发性能）
        db.pragma('journal_mode = WAL');

        // 创建 remote_rooms 表
        console.log('创建 remote_rooms 表...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS remote_rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_code TEXT UNIQUE NOT NULL,
                host_cid_hash TEXT NOT NULL,
                room_name TEXT,
                max_members INTEGER DEFAULT 10,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (host_cid_hash) REFERENCES whitelist(cid_hash)
            )
        `);

        // 创建 remote_rooms 索引
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_rooms_room_code ON remote_rooms(room_code)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_rooms_host_cid ON remote_rooms(host_cid_hash)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_rooms_status ON remote_rooms(status)`);

        console.log('✅ remote_rooms 表创建完成');

        // 创建 remote_room_members 表
        console.log('创建 remote_room_members 表...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS remote_room_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                cid_hash TEXT NOT NULL,
                character_name TEXT,
                world_name TEXT,
                role TEXT DEFAULT 'Member',
                job_role TEXT,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_connected INTEGER DEFAULT 1,
                FOREIGN KEY (room_id) REFERENCES remote_rooms(id) ON DELETE CASCADE
            )
        `);

        // 创建 remote_room_members 索引
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_room_members_room_id ON remote_room_members(room_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_room_members_cid_hash ON remote_room_members(cid_hash)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_room_members_last_active ON remote_room_members(last_active)`);

        console.log('✅ remote_room_members 表创建完成');

        // 创建 remote_commands 表
        console.log('创建 remote_commands 表...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS remote_commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                sender_cid_hash TEXT NOT NULL,
                target_cid_hash TEXT,
                command_type TEXT NOT NULL,
                command_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                executed_at DATETIME,
                FOREIGN KEY (room_id) REFERENCES remote_rooms(id) ON DELETE CASCADE
            )
        `);

        // 创建 remote_commands 索引
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_commands_room_id ON remote_commands(room_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_commands_status ON remote_commands(status)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_commands_created_at ON remote_commands(created_at)`);

        console.log('✅ remote_commands 表创建完成');

        console.log('\n🎉 遥控系统数据表迁移完成！');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        db.close();
    }
}

// 执行迁移
if (require.main === module) {
    migrateRemoteSystem();
}

module.exports = { migrateRemoteSystem };
