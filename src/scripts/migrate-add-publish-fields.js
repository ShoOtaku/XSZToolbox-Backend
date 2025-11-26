/**
 * 添加公开房间字段迁移脚本
 * 为 remote_rooms 表添加 is_published, published_at, publish_expires_at 字段
 */

require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 获取数据库路径（与应用保持一致）
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/xsztoolbox.db');

function migrateAddPublishFields() {
    console.log('开始添加公开房间字段迁移...');
    console.log(`目标数据库: ${dbPath}`);

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);

    try {
        // 启用WAL模式
        db.pragma('journal_mode = WAL');

        // 检查字段是否已存在
        const tableInfo = db.prepare('PRAGMA table_info(remote_rooms)').all();

        if (!tableInfo || tableInfo.length === 0) {
            throw new Error('remote_rooms 表不存在，请先执行 migrate-remote-system.js 创建遥控相关表');
        }

        const hasIsPublished = tableInfo.some(col => col.name === 'is_published');

        if (hasIsPublished) {
            console.log('⚠️  字段已存在，跳过迁移');
            return;
        }

        console.log('添加 is_published 字段...');
        db.exec('ALTER TABLE remote_rooms ADD COLUMN is_published INTEGER DEFAULT 0');

        console.log('添加 published_at 字段...');
        db.exec('ALTER TABLE remote_rooms ADD COLUMN published_at DATETIME');

        console.log('添加 publish_expires_at 字段...');
        db.exec('ALTER TABLE remote_rooms ADD COLUMN publish_expires_at DATETIME');

        console.log('创建索引...');
        db.exec(`CREATE INDEX IF NOT EXISTS idx_remote_rooms_published
                 ON remote_rooms(is_published, publish_expires_at)`);

        console.log('\n🎉 公开房间字段迁移完成！');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        db.close();
    }
}

// 执行迁移
if (require.main === module) {
    migrateAddPublishFields();
}

module.exports = { migrateAddPublishFields };
