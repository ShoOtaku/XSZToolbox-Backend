/**
 * 房间数据模型
 * 处理 remote_rooms 和 remote_room_members 表的CRUD操作
 */

const { getInstance } = require('./database');

class RoomModel {
    /**
     * 创建房间
     * @param {Object} roomData - 房间数据
     * @param {string} roomData.roomCode - 房间码
     * @param {string} roomData.hostCidHash - 房主CID哈希
     * @param {string} [roomData.roomName] - 房间名称
     * @param {number} [roomData.maxMembers=10] - 最大成员数
     * @param {Date} [roomData.expiresAt] - 过期时间
     * @returns {Object} 创建的房间记录
     */
    static createRoom(roomData) {
        const db = getInstance();
        const { roomCode, hostCidHash, roomName = null, maxMembers = 10, expiresAt } = roomData;

        const stmt = db.prepare(`
            INSERT INTO remote_rooms (room_code, host_cid_hash, room_name, max_members, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(roomCode, hostCidHash, roomName, maxMembers, expiresAt);

        // 自动添加房主为成员
        this.addMember({
            roomId: result.lastInsertRowid,
            cidHash: hostCidHash,
            role: 'Host',
            isConnected: true
        });

        return this.getRoomById(result.lastInsertRowid);
    }

    /**
     * 根据房间码查询房间
     * @param {string} roomCode - 房间码
     * @returns {Object|null} 房间记录
     */
    static getRoomByCode(roomCode) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_rooms WHERE room_code = ?
        `);
        return stmt.get(roomCode);
    }

    /**
     * 根据ID查询房间
     * @param {number} roomId - 房间ID
     * @returns {Object|null} 房间记录
     */
    static getRoomById(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_rooms WHERE id = ?
        `);
        return stmt.get(roomId);
    }

    /**
     * 添加成员到房间
     * @param {Object} memberData - 成员数据
     * @param {number} memberData.roomId - 房间ID
     * @param {string} memberData.cidHash - 成员CID哈希
     * @param {string} [memberData.characterName] - 角色名
     * @param {string} [memberData.worldName] - 服务器名
     * @param {string} [memberData.role='Member'] - 角色权限
     * @param {string} [memberData.jobRole] - 职业标识（MT/ST/H1/H2/D1-D4）
     * @param {boolean} [memberData.isConnected=true] - 是否在线
     * @returns {Object} 插入结果
     */
    static addMember(memberData) {
        const db = getInstance();
        const {
            roomId, cidHash, characterName = null, worldName = null,
            role = 'Member', jobRole = null, isConnected = true
        } = memberData;

        const stmt = db.prepare(`
            INSERT INTO remote_room_members
            (room_id, cid_hash, character_name, world_name, role, job_role, is_connected)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run(roomId, cidHash, characterName, worldName, role, jobRole, isConnected ? 1 : 0);
    }

    /**
     * 获取房间所有成员
     * @param {number} roomId - 房间ID
     * @returns {Array} 成员列表
     */
    static getRoomMembers(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_room_members
            WHERE room_id = ?
            ORDER BY
                CASE role
                    WHEN 'Host' THEN 1
                    WHEN 'Leader' THEN 2
                    ELSE 3
                END,
                joined_at ASC
        `);
        return stmt.all(roomId);
    }

    /**
     * 获取房间成员数量
     * @param {number} roomId - 房间ID
     * @returns {number} 成员数量
     */
    static getMemberCount(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT COUNT(*) as count FROM remote_room_members WHERE room_id = ?
        `);
        return stmt.get(roomId).count;
    }

    /**
     * 查询指定成员是否在房间中
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @returns {Object|null} 成员记录
     */
    static getMember(roomId, cidHash) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_room_members
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.get(roomId, cidHash);
    }

    /**
     * 更新成员在线状态
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {boolean} isConnected - 是否在线
     * @returns {Object} 更新结果
     */
    static updateMemberStatus(roomId, cidHash, isConnected) {
        const db = getInstance();
        const stmt = db.prepare(`
            UPDATE remote_room_members
            SET is_connected = ?, last_active = CURRENT_TIMESTAMP
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.run(isConnected ? 1 : 0, roomId, cidHash);
    }

    /**
     * 更新成员最后活跃时间
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @returns {Object} 更新结果
     */
    static updateMemberLastActive(roomId, cidHash) {
        const db = getInstance();
        const stmt = db.prepare(`
            UPDATE remote_room_members
            SET last_active = CURRENT_TIMESTAMP
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.run(roomId, cidHash);
    }

    /**
     * 设置成员角色权限
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string} role - 角色（Host/Leader/Member）
     * @returns {Object} 更新结果
     */
    static updateMemberRole(roomId, cidHash, role) {
        const db = getInstance();
        const stmt = db.prepare(`
            UPDATE remote_room_members
            SET role = ?
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.run(role, roomId, cidHash);
    }

    /**
     * 设置成员职业标识
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string} jobRole - 职业标识（MT/ST/H1/H2/D1-D4）
     * @returns {Object} 更新结果
     */
    static updateMemberJobRole(roomId, cidHash, jobRole) {
        const db = getInstance();
        const stmt = db.prepare(`
            UPDATE remote_room_members
            SET job_role = ?
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.run(jobRole, roomId, cidHash);
    }

    /**
     * 移除成员
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @returns {Object} 删除结果
     */
    static removeMember(roomId, cidHash) {
        const db = getInstance();
        const stmt = db.prepare(`
            DELETE FROM remote_room_members
            WHERE room_id = ? AND cid_hash = ?
        `);
        return stmt.run(roomId, cidHash);
    }

    /**
     * 关闭房间
     * @param {number} roomId - 房间ID
     * @returns {Object} 更新结果
     */
    static closeRoom(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            UPDATE remote_rooms
            SET status = 'closed'
            WHERE id = ?
        `);
        return stmt.run(roomId);
    }

    /**
     * 删除房间（级联删除成员和指令）
     * @param {number} roomId - 房间ID
     * @returns {Object} 删除结果
     */
    static deleteRoom(roomId) {
        const db = getInstance();
        const stmt = db.prepare(`
            DELETE FROM remote_rooms WHERE id = ?
        `);
        return stmt.run(roomId);
    }

    /**
     * 获取过期的房间
     * @returns {Array} 过期房间列表
     */
    static getExpiredRooms() {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_rooms
            WHERE status = 'active' AND expires_at <= CURRENT_TIMESTAMP
        `);
        return stmt.all();
    }

    /**
     * 查询用户创建的活跃房间
     * @param {string} cidHash - 用户CID哈希
     * @returns {Array} 房间列表
     */
    static getUserActiveRooms(cidHash) {
        const db = getInstance();
        const stmt = db.prepare(`
            SELECT * FROM remote_rooms
            WHERE host_cid_hash = ? AND status = 'active'
            ORDER BY created_at DESC
        `);
        return stmt.all(cidHash);
    }

    /**
     * 根据regex role选择成员
     * @param {number} roomId - 房间ID
     * @param {string} regexRole - 正则表达式（如 "MT|ST" 或 "D1|D2"）
     * @returns {Array} 匹配的成员列表
     */
    static selectMembersByRole(roomId, regexRole) {
        const members = this.getRoomMembers(roomId);

        if (!regexRole || regexRole === '') {
            // 空字符串 = 所有在线成员
            return members.filter(m => m.is_connected === 1);
        }

        const regex = new RegExp(`^(${regexRole})$`, 'i');
        return members.filter(m => {
            return m.is_connected === 1 && m.job_role && regex.test(m.job_role);
        });
    }

    /**
     * 公开房间（设置有效期）
     * @param {string} roomCode - 房间码
     * @param {number} durationSeconds - 公开持续时间（秒，默认30秒）
     * @returns {Object} 包含 success 和 expiresAt 的对象
     */
    static publishRoom(roomCode, durationSeconds = 30) {
        const db = getInstance();

        // 计算过期时间
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

        // 转换为 SQLite 兼容的时间格式 (YYYY-MM-DD HH:MM:SS)
        const sqliteFormat = expiresAt.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

        const stmt = db.prepare(`
            UPDATE remote_rooms
            SET is_published = 1,
                published_at = CURRENT_TIMESTAMP,
                publish_expires_at = ?
            WHERE room_code = ? AND status = 'active'
        `);

        const result = stmt.run(sqliteFormat, roomCode);

        return {
            success: result.changes > 0,
            expiresAt: sqliteFormat
        };
    }

    /**
     * 获取所有公开且未过期的房间
     * @returns {Array} 公开房间列表，包含房间信息、房主名称和成员数
     */
    static getPublicRooms() {
        const db = getInstance();

        const stmt = db.prepare(`
            SELECT
                r.room_code,
                r.room_name,
                r.max_members,
                h.character_name as host_name,
                (SELECT COUNT(*) FROM remote_room_members WHERE room_id = r.id) as member_count
            FROM remote_rooms r
            LEFT JOIN remote_room_members h
                ON r.id = h.room_id AND h.role = 'Host'
            WHERE r.status = 'active'
                AND r.is_published = 1
                AND datetime(r.publish_expires_at) > datetime('now')
            ORDER BY r.published_at DESC
        `);

        return stmt.all();
    }
}

module.exports = RoomModel;
