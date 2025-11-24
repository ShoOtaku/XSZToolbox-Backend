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
