/**
 * 认证管理模块
 */

class AuthManager {
    constructor() {
        this.TOKEN_KEY = 'xsz_admin_token';
        this.token = this.getToken();
    }

    /**
     * 从 localStorage 获取 Token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * 保存 Token 到 localStorage
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem(this.TOKEN_KEY, token);
    }

    /**
     * 清除 Token
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem(this.TOKEN_KEY);
    }

    /**
     * 检查是否已登录
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * 获取认证头
     */
    getAuthHeader() {
        if (!this.token) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this.token}`
        };
    }

    /**
     * 解析 JWT Token
     */
    parseToken() {
        if (!this.token) return null;

        try {
            const base64Url = this.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Token 解析失败:', error);
            return null;
        }
    }

    /**
     * 检查 Token 是否过期
     */
    isTokenExpired() {
        const payload = this.parseToken();
        if (!payload || !payload.exp) return true;

        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    }

    /**
     * 登出
     */
    logout() {
        this.clearToken();
        window.location.reload();
    }
}

// 导出全局实例
const authManager = new AuthManager();
