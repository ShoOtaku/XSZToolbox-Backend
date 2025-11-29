/**
 * API 调用封装
 */

class APIClient {
    constructor() {
        // 自动检测 API 地址
        this.baseURL = this.detectAPIUrl();
    }

    /**
     * 自动检测 API 地址
     */
    detectAPIUrl() {
        // 如果在管理面板路径下，使用相对路径
        if (window.location.pathname.startsWith('/admin')) {
            return window.location.origin;
        }
        // 本地开发时
        return 'http://localhost:3000';
    }

    /**
     * 通用请求方法
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...authManager.getAuthHeader(),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                // Token 过期，自动登出
                if (response.status === 401) {
                    authManager.logout();
                }
                const error = new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.details = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('API 请求失败:', error);
            throw error;
        }
    }

    /**
     * GET 请求
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST 请求
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT 请求
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE 请求
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ==================== 认证接口 ====================

    /**
     * 管理员登录（新版：用户名/密码）
     */
    async login(username, password) {
        return this.post('/api/admin/login', {
            username,
            password
        });
    }

    // ==================== 统计接口 ====================

    /**
     * 获取统计数据
     */
    async getStats() {
        return this.get('/api/admin/stats');
    }

    /**
     * 获取服务器活跃度统计
     * @param {Object} params
     * @param {number} [params.worldId]
     * @param {number} [params.days]
     * @param {string} [params.startDate]
     * @param {string} [params.endDate]
     */
    async getActivityStatistics(params = {}) {
        const query = new URLSearchParams();
        if (params.worldId) query.set('world_id', params.worldId);
        if (params.days) query.set('days', params.days);
        if (params.startDate) query.set('start_date', params.startDate);
        if (params.endDate) query.set('end_date', params.endDate);

        const qs = query.toString();
        const endpoint = qs ? `/api/activity/statistics?${qs}` : '/api/activity/statistics';
        return this.get(endpoint);
    }

    /**
     * 获取玩家信息列表
     */
    async getActivityPlayers(params = {}) {
        const query = new URLSearchParams();
        if (params.worldId) query.set('world_id', params.worldId);
        if (params.search) query.set('search', params.search);
        if (params.cid) query.set('cid', params.cid);
        if (params.limit) query.set('limit', params.limit);
        if (params.offset) query.set('offset', params.offset);

        const qs = query.toString();
        const endpoint = qs ? `/api/activity/players?${qs}` : '/api/activity/players';
        return this.get(endpoint);
    }

    // ==================== 白名单接口 ====================

    /**
     * 获取所有白名单
     */
    async getWhitelist(limit = 100, offset = 0) {
        return this.get(`/api/admin/whitelist?limit=${limit}&offset=${offset}`);
    }

    /**
     * 添加白名单（新版：明文 CID）
     */
    async addWhitelist(cid, note) {
        return this.post('/api/admin/whitelist/add', {
            cid: cid,
            note: note || ''
        });
    }

    /**
     * 更新白名单
     */
    async updateWhitelist(cidHash, payload) {
        return this.put(`/api/admin/whitelist/${cidHash}`, payload);
    }

    /**
     * 移除白名单
     */
    async removeWhitelist(cidHash) {
        return this.delete(`/api/admin/whitelist/${cidHash}`);
    }

    // ==================== 用户接口 ====================

    /**
     * 获取所有用户
     */
    async getUsers({ limit = 100, offset = 0, searchType, characterName, cid, worldName } = {}) {
        const params = new URLSearchParams();
        params.set('limit', limit);
        params.set('offset', offset);
        if (searchType) params.set('searchType', searchType);
        if (characterName) params.set('characterName', characterName);
        if (cid) params.set('cid', cid);
        if (worldName) params.set('worldName', worldName);

        return this.get(`/api/admin/users?${params.toString()}`);
    }

    // ==================== 日志接口 ====================

    /**
     * 获取审计日志
     */
    async getLogs(limit = 100, offset = 0, action = '') {
        const actionParam = action ? `&action=${action}` : '';
        return this.get(`/api/admin/logs?limit=${limit}&offset=${offset}${actionParam}`);
    }

    // ==================== 房间管理接口 ====================

    /**
     * 获取房间列表
     * @param {string} status - 状态筛选 ('active' | 'closed' | 'all')
     * @param {number} limit - 数量限制
     * @param {number} offset - 偏移量
     */
    async getRooms(status = 'active', limit = 100, offset = 0) {
        return this.get(`/api/admin/rooms?status=${status}&limit=${limit}&offset=${offset}`);
    }

    /**
     * 获取房间成员详情
     * @param {number} roomId - 房间ID
     */
    async getRoomMembers(roomId) {
        return this.get(`/api/admin/rooms/${roomId}/members`);
    }

    /**
     * 管理员关闭房间
     * @param {number} roomId - 房间ID
     */
    async adminCloseRoom(roomId) {
        return this.delete(`/api/admin/rooms/${roomId}`);
    }

    /**
     * 更新成员职能标识
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string|null} jobRole - 职能标识 (MT/ST/H1/H2/D1-D4/null)
     */
    async updateMemberJobRole(roomId, cidHash, jobRole) {
        return this.put(`/api/admin/room/${roomId}/member/${cidHash}/job`, {
            jobRole
        });
    }

    /**
     * 更新成员权限角色
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string} role - 权限角色 (Host/Leader/Member)
     */
    async updateMemberRole(roomId, cidHash, role) {
        return this.put(`/api/admin/room/${roomId}/member/${cidHash}/role`, {
            role
        });
    }

    /**
     * 发送房间指令
     * @param {number} roomId - 房间ID
     * @param {Object} commandData - 指令数据
     * @param {string} commandData.targetType - 目标类型 ('all' | 'single')
     * @param {string} [commandData.targetCidHash] - 目标成员CID哈希（targetType为'single'时必需）
     * @param {string} commandData.commandType - 指令类型 (move/jump/setpos/chat/echo等)
     * @param {Object} commandData.commandParams - 指令参数
     */
    async sendRoomCommand(roomId, commandData) {
        return this.post(`/api/admin/room/${roomId}/command`, commandData);
    }

    /**
     * 获取房间指令历史
     * @param {number} roomId - 房间ID
     * @param {number} [limit=10] - 返回记录数量限制
     */
    async getRoomCommandHistory(roomId, limit = 10) {
        return this.get(`/api/admin/room/${roomId}/commands?limit=${limit}`);
    }

    // ==================== 用户管理接口 ====================

    /**
     * 获取用户列表（管理员用户）
     * @param {Object} params - 查询参数
     * @param {number} [params.limit] - 每页数量
     * @param {number} [params.offset] - 偏移量
     * @param {string} [params.role] - 角色筛选
     */
    async getUserList(params = {}) {
        const query = new URLSearchParams();
        if (params.limit) query.set('limit', params.limit);
        if (params.offset) query.set('offset', params.offset);
        if (params.role) query.set('role', params.role);

        const qs = query.toString();
        const endpoint = qs ? `/api/admin/users/list?${qs}` : '/api/admin/users/list';
        return this.get(endpoint);
    }

    /**
     * 创建用户
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @param {string} role - 角色 (admin | viewer)
     */
    async createUser(username, password, role) {
        return this.post('/api/admin/users/create', {
            username,
            password,
            role
        });
    }

    /**
     * 更新用户
     * @param {number} userId - 用户ID
     * @param {Object} updates - 更新内容
     * @param {string} [updates.username] - 新用户名
     * @param {string} [updates.password] - 新密码
     * @param {string} [updates.role] - 新角色
     */
    async updateUser(userId, updates) {
        return this.put(`/api/admin/users/${userId}`, updates);
    }

    /**
     * 删除用户
     * @param {number} userId - 用户ID
     */
    async deleteUser(userId) {
        return this.delete(`/api/admin/users/${userId}`);
    }

    // ==================== 账号管理接口 ====================

    /**
     * 修改密码
     * @param {string} currentPassword - 当前密码
     * @param {string} newPassword - 新密码
     */
    async changePassword(currentPassword, newPassword) {
        return this.post('/api/admin/account/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }

    /**
     * 修改用户名
     * @param {string} newUsername - 新用户名
     * @param {string} password - 当前密码
     */
    async changeUsername(newUsername, password) {
        return this.put('/api/admin/account/change-username', {
            new_username: newUsername,
            password: password
        });
    }

    // ==================== 健康检查 ====================

    /**
     * 健康检查
     */
    async health() {
        return this.get('/api/health');
    }
}

// 导出全局实例
const api = new APIClient();
