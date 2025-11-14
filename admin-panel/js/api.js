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
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
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
     * DELETE 请求
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ==================== 认证接口 ====================

    /**
     * 管理员登录
     */
    async login(cidHash) {
        return this.post('/api/admin/login', { cid_hash: cidHash });
    }

    // ==================== 统计接口 ====================

    /**
     * 获取统计数据
     */
    async getStats() {
        return this.get('/api/admin/stats');
    }

    // ==================== 白名单接口 ====================

    /**
     * 获取所有白名单
     */
    async getWhitelist(limit = 100, offset = 0) {
        return this.get(`/api/admin/whitelist?limit=${limit}&offset=${offset}`);
    }

    /**
     * 添加白名单
     */
    async addWhitelist(cidHash, note) {
        return this.post('/api/admin/whitelist/add', {
            cid_hash: cidHash,
            note: note || ''
        });
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
    async getUsers(limit = 100, offset = 0) {
        return this.get(`/api/admin/users?limit=${limit}&offset=${offset}`);
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
