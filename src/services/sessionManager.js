/**
 * 会话管理器
 * 管理 Socket.IO 连接和 CID 的映射关系
 */

class SessionManager {
    constructor() {
        // CID哈希 -> { socketId, roomCode }
        this.cidToSession = new Map();
        // Socket ID -> CID哈希
        this.socketToCid = new Map();
    }

    /**
     * 注册会话
     * @param {string} cidHash - CID哈希
     * @param {string} socketId - Socket ID
     * @param {string} roomCode - 房间码
     */
    register(cidHash, socketId, roomCode) {
        // 如果该CID已有会话，先注销旧会话
        if (this.cidToSession.has(cidHash)) {
            const oldSession = this.cidToSession.get(cidHash);
            this.socketToCid.delete(oldSession.socketId);
        }

        this.cidToSession.set(cidHash, { socketId, roomCode });
        this.socketToCid.set(socketId, cidHash);

        console.log(`[SessionManager] 注册会话: CID=${cidHash.substring(0, 8)}..., Socket=${socketId.substring(0, 8)}..., Room=${roomCode}`);
    }

    /**
     * 注销会话
     * @param {string} cidHash - CID哈希
     */
    unregister(cidHash) {
        const session = this.cidToSession.get(cidHash);
        if (session) {
            this.socketToCid.delete(session.socketId);
            this.cidToSession.delete(cidHash);
            console.log(`[SessionManager] 注销会话: CID=${cidHash.substring(0, 8)}...`);
        }
    }

    /**
     * 通过Socket ID获取CID哈希
     * @param {string} socketId - Socket ID
     * @returns {string|null} CID哈希
     */
    getCidBySocketId(socketId) {
        return this.socketToCid.get(socketId) || null;
    }

    /**
     * 通过CID哈希获取Socket ID
     * @param {string} cidHash - CID哈希
     * @returns {string|null} Socket ID
     */
    getSocketIdByCid(cidHash) {
        const session = this.cidToSession.get(cidHash);
        return session ? session.socketId : null;
    }

    /**
     * 通过CID哈希获取房间码
     * @param {string} cidHash - CID哈希
     * @returns {string|null} 房间码
     */
    getRoomCodeByCid(cidHash) {
        const session = this.cidToSession.get(cidHash);
        return session ? session.roomCode : null;
    }

    /**
     * 获取会话数量
     * @returns {number} 活跃会话数
     */
    getSessionCount() {
        return this.cidToSession.size;
    }

    /**
     * 检查CID是否在线
     * @param {string} cidHash - CID哈希
     * @returns {boolean} 是否在线
     */
    isOnline(cidHash) {
        return this.cidToSession.has(cidHash);
    }

    /**
     * 获取所有活跃会话
     * @returns {Array} 会话列表
     */
    getAllSessions() {
        const sessions = [];
        for (const [cidHash, session] of this.cidToSession.entries()) {
            sessions.push({
                cidHash,
                socketId: session.socketId,
                roomCode: session.roomCode
            });
        }
        return sessions;
    }

    /**
     * 清空所有会话
     */
    clear() {
        this.cidToSession.clear();
        this.socketToCid.clear();
        console.log('[SessionManager] 所有会话已清空');
    }
}

module.exports = SessionManager;
