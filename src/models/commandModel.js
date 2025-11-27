/**
 * 指令记录数据模型
 * 处理 remote_commands 表的CRUD操作
 */

const { getInstance } = require('./database');

class CommandModel {
    /**
     * 创建指令记录
     * @param {Object} commandData - 指令数据
     * @param {number} commandData.roomId - 房间ID
     * @param {string} commandData.senderCidHash - 发送者CID哈希
     * @param {string} [commandData.targetCidHash] - 目标CID哈希（null=全体）
     * @param {string} commandData.commandType - 指令类型
     * @param {string} commandData.commandData - JSON格式参数
     * @param {string} [commandData.status='pending'] - 状态
     * @returns {Object} 创建的指令记录
     */
    static createCommand(commandData) {
        const db = getInstance();
        const {
            roomId,
            senderCidHash,
            targetCidHash = null,
            commandType,
            commandData: data,
            status = 'pending'
        } = commandData;

        // Defensive validation: ensure command_data is never NULL or invalid
        let sanitizedData = data;
        if (!data || data === 'undefined' || data === 'null' || data.trim() === '') {
            console.warn('[CommandModel] Invalid command_data detected, using empty object. Original value:', data);
            sanitizedData = '{}';
        }

        const stmt = db.prepare(`
            INSERT INTO remote_commands
            (room_id, sender_cid_hash, target_cid_hash, command_type, command_data, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(roomId, senderCidHash, targetCidHash, commandType, sanitizedData, status);

        return this.getCommandById(result.lastInsertRowid);
    }

    /**
     * 根据ID查询指令
     * @param {number} commandId - 指令ID
     * @returns {Object|null} 指令记录
     */
    static getCommandById(commandId) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_commands WHERE id = ?
        `);
        return stmt.get(commandId);
    }

    /**
     * 更新指令状态
     * @param {Object} updateData - 更新数据
     * @param {number} updateData.commandId - 指令ID
     * @param {string} updateData.status - 新状态（executed/failed）
     * @param {string} [updateData.errorMessage] - 错误消息
     * @param {Date} [updateData.executedAt] - 执行时间
     * @returns {Object} 更新结果
     */
    static updateCommandStatus(updateData) {
        const db = getInstance();
        const { commandId, status, errorMessage = null, executedAt = new Date() } = updateData;

        // 将 Date 对象转换为 ISO 字符串格式
        const executedAtStr = executedAt instanceof Date ? executedAt.toISOString() : executedAt;

        const stmt = db.prepare(`
            UPDATE remote_commands
            SET status = ?, error_message = ?, executed_at = ?
            WHERE id = ?
        `);

        return stmt.run(status, errorMessage, executedAtStr, commandId);
    }

    /**
     * 获取房间的指令历史
     * @param {number} roomId - 房间ID
     * @param {Object} [options] - 查询选项
     * @param {number} [options.limit=100] - 限制数量
     * @param {number} [options.offset=0] - 偏移量
     * @returns {Array} 指令历史列表
     */
    static getRoomCommands(roomId, options = {}) {
        const db = getInstance();
        const { limit = 100, offset = 0 } = options;

        const stmt = db.prepare(`
            SELECT * FROM remote_commands
            WHERE room_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `);

        return stmt.all(roomId, limit, offset);
    }

    /**
     * 获取指定状态的指令
     * @param {number} roomId - 房间ID
     * @param {string} status - 状态（pending/executed/failed）
     * @returns {Array} 指令列表
     */
    static getCommandsByStatus(roomId, status) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_commands
            WHERE room_id = ? AND status = ?
            ORDER BY created_at DESC
        `);
        return stmt.all(roomId, status);
    }

    /**
     * 获取待执行的指令（pending状态）
     * @param {number} roomId - 房间ID
     * @returns {Array} 待执行指令列表
     */
    static getPendingCommands(roomId) {
        return this.getCommandsByStatus(roomId, 'pending');
    }

    /**
     * 删除房间的所有指令记录
     * @param {number} roomId - 房间ID
     * @returns {Object} 删除结果
     */
    static deleteRoomCommands(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            DELETE FROM remote_commands WHERE room_id = ?
        `);
        return stmt.run(roomId);
    }

    /**
     * 清理旧的指令记录（保留最近N天）
     * @param {number} days - 保留天数
     * @returns {Object} 删除结果
     */
    static cleanOldCommands(days = 30) {
        const db = getInstance();
        const stmt = db.prepare(`
            DELETE FROM remote_commands
            WHERE created_at < datetime('now', '-' || ? || ' days')
        `);
        return stmt.run(days);
    }

    /**
     * 获取指令统计信息
     * @param {number} roomId - 房间ID
     * @returns {Object} 统计信息
     */
    static getCommandStatistics(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM remote_commands
            WHERE room_id = ?
        `);
        return stmt.get(roomId);
    }

    /**
     * 获取指定发送者的指令历史
     * @param {number} roomId - 房间ID
     * @param {string} senderCidHash - 发送者CID哈希
     * @param {number} [limit=50] - 限制数量
     * @returns {Array} 指令历史列表
     */
    static getSenderCommands(roomId, senderCidHash, limit = 50) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_commands
            WHERE room_id = ? AND sender_cid_hash = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);
        return stmt.all(roomId, senderCidHash, limit);
    }

    /**
     * 获取指定目标的指令历史
     * @param {number} roomId - 房间ID
     * @param {string} targetCidHash - 目标CID哈希
     * @param {number} [limit=50] - 限制数量
     * @returns {Array} 指令历史列表
     */
    static getTargetCommands(roomId, targetCidHash, limit = 50) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_commands
            WHERE room_id = ? AND target_cid_hash = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);
        return stmt.all(roomId, targetCidHash, limit);
    }
}

module.exports = CommandModel;
