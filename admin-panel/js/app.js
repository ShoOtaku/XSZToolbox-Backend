/**
 * 主应用逻辑
 */

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        // 检查登录状态
        if (authManager.isAuthenticated() && !authManager.isTokenExpired()) {
            this.showMainPage();
        } else {
            this.showLoginPage();
        }

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 登录按钮
        document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());

        // 登出按钮
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // 导航项
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.switchPage(page);
            });
        });

        // 刷新按钮
        document.getElementById('refreshStatsBtn')?.addEventListener('click', () => this.loadDashboard());
        document.getElementById('refreshUsersBtn')?.addEventListener('click', () => this.loadUsers());
        document.getElementById('refreshLogsBtn')?.addEventListener('click', () => this.loadLogs());

        // 白名单管理
        document.getElementById('addWhitelistBtn')?.addEventListener('click', () => this.showAddWhitelistForm());
        document.getElementById('submitWhitelistBtn')?.addEventListener('click', () => this.handleAddWhitelist());
        document.getElementById('cancelWhitelistBtn')?.addEventListener('click', () => this.hideAddWhitelistForm());

        // 日志过滤
        document.getElementById('logActionFilter')?.addEventListener('change', () => this.loadLogs());

        // 回车登录
        ['username', 'password'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        });
    }

    /**
     * 显示登录页面
     */
    showLoginPage() {
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('mainPage').classList.remove('active');
    }

    /**
     * 显示主页面
     */
    showMainPage() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('mainPage').classList.add('active');
        this.switchPage('dashboard');
    }

    /**
     * 切换页面
     */
    switchPage(page) {
        // 更新导航高亮
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // 隐藏所有内容区域
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // 显示目标内容区域
        const targetContent = document.getElementById(`${page}Content`);
        if (targetContent) {
            targetContent.classList.add('active');
            this.currentPage = page;

            // 加载数据
            this.loadPageData(page);
        }
    }

    /**
     * 加载页面数据
     */
    loadPageData(page) {
        switch (page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'whitelist':
                this.loadWhitelist();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'logs':
                this.loadLogs();
                break;
        }
    }

    /**
     * 处理登录（新版：用户名/密码）
     */
    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorElement = document.getElementById('loginError');

        // 验证输入
        if (!username || !password) {
            this.showError(errorElement, '请输入用户名和密码');
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.login(username, password);

            if (response.success) {
                authManager.setToken(response.token);
                this.showToast('登录成功！', 'success');
                setTimeout(() => this.showMainPage(), 500);
            } else {
                this.showError(errorElement, response.message || '登录失败');
            }
        } catch (error) {
            this.showError(errorElement, error.message || '登录失败，请检查网络连接');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理登出
     */
    handleLogout() {
        if (confirm('确定要退出登录吗？')) {
            authManager.logout();
        }
    }

    /**
     * 加载仪表盘数据
     */
    async loadDashboard() {
        try {
            this.showLoading(true);
            const response = await api.getStats();

            if (response.success) {
                const { stats } = response;

                // 更新统计卡片
                document.getElementById('totalUsers').textContent = stats.total_users || 0;
                document.getElementById('activeToday').textContent = stats.active_today || 0;
                document.getElementById('whitelistCount').textContent = stats.whitelist_count || 0;
                document.getElementById('newUsers7d').textContent = stats.new_users_7d || 0;

                // 更新服务器排行榜
                this.renderTopServers(stats.top_servers || []);

                // 更新最近活动
                this.renderRecentLogs(stats.recent_logs || []);

                this.showToast('数据刷新成功', 'success');
            }
        } catch (error) {
            this.showToast(error.message || '加载数据失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染服务器排行榜
     */
    renderTopServers(servers) {
        const container = document.getElementById('topServers');

        if (servers.length === 0) {
            container.innerHTML = '<p style="color: #999;">暂无数据</p>';
            return;
        }

        const html = servers.map((server, index) => `
            <div class="server-item">
                <div class="server-name">
                    ${index + 1}. ${server.world_name || '未知'}
                </div>
                <div class="server-count">${server.count} 人</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * 渲染最近活动
     */
    renderRecentLogs(logs) {
        const container = document.getElementById('recentLogs');

        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #999;">暂无数据</p>';
            return;
        }

        const actionNames = {
            'user_submit': '用户提交',
            'user_verify': '用户验证',
            'admin_login': '管理员登录',
            'whitelist_add': '添加白名单',
            'whitelist_remove': '移除白名单'
        };

        const html = logs.map(log => `
            <div class="log-item">
                <div>
                    <strong>${actionNames[log.action] || log.action}</strong>
                    <span style="color: #999; font-size: 12px;"> × ${log.count}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * 加载白名单
     */
    async loadWhitelist() {
        try {
            this.showLoading(true);
            const response = await api.getWhitelist(100, 0);

            if (response.success) {
                this.renderWhitelistTable(response.whitelist || []);
            }
        } catch (error) {
            this.showToast(error.message || '加载白名单失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染白名单表格
     */
    renderWhitelistTable(whitelist) {
        const tbody = document.getElementById('whitelistTable');

        if (whitelist.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无白名单</td></tr>';
            return;
        }

        const html = whitelist.map(entry => {
            // 确保 cid_hash 存在且有效
            const cidHash = entry.cid_hash || '';
            const canDelete = cidHash.length === 64; // SHA256 哈希长度为 64

            return `
            <tr>
                <td>${entry.cid || '<span style="color:#999;">未记录</span>'}</td>
                <td>${entry.note || '-'}</td>
                <td>${this.formatDate(entry.added_at)}</td>
                <td>${entry.added_by || '-'}</td>
                <td>
                    ${canDelete
                        ? `<button class="btn btn-danger btn-sm" onclick="app.handleRemoveWhitelist('${cidHash}')">删除</button>`
                        : '<span style="color:#999;">无法删除</span>'}
                </td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    /**
     * 显示添加白名单表单
     */
    showAddWhitelistForm() {
        document.getElementById('addWhitelistForm').style.display = 'block';
        document.getElementById('newCid').value = '';
        document.getElementById('newNote').value = '';
    }

    /**
     * 隐藏添加白名单表单
     */
    hideAddWhitelistForm() {
        document.getElementById('addWhitelistForm').style.display = 'none';
    }

    /**
     * 处理添加白名单（新版：明文 CID）
     */
    async handleAddWhitelist() {
        const cid = document.getElementById('newCid').value.trim();
        const note = document.getElementById('newNote').value.trim();

        if (!cid) {
            this.showToast('请输入 CID', 'error');
            return;
        }

        // 验证 CID 格式（应该是数字）
        if (!/^\d+$/.test(cid)) {
            this.showToast('CID 必须是数字', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.addWhitelist(cid, note);

            if (response.success) {
                this.showToast('添加成功！', 'success');
                this.hideAddWhitelistForm();
                this.loadWhitelist();
            }
        } catch (error) {
            this.showToast(error.message || '添加失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理移除白名单
     */
    async handleRemoveWhitelist(cidHash) {
        // 验证 CID 哈希有效性
        if (!cidHash || cidHash.length !== 64) {
            this.showToast('无效的 CID 哈希', 'error');
            console.error('无效的 cidHash:', cidHash);
            return;
        }

        if (!confirm(`确定要移除该用户吗？\n\nCID 哈希: ${cidHash}`)) {
            return;
        }

        try {
            this.showLoading(true);
            console.log('正在删除白名单:', cidHash);
            const response = await api.removeWhitelist(cidHash);

            if (response.success) {
                this.showToast('移除成功！', 'success');
                this.loadWhitelist();
            } else {
                this.showToast(response.message || '移除失败', 'error');
            }
        } catch (error) {
            console.error('删除白名单失败:', error);
            this.showToast(error.message || '移除失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 加载用户列表
     */
    async loadUsers() {
        try {
            this.showLoading(true);
            const response = await api.getUsers(100, 0);

            if (response.success) {
                this.renderUsersTable(response.users || []);
            }
        } catch (error) {
            this.showToast(error.message || '加载用户列表失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染用户表格（显示明文 CID 和 QQ）
     */
    renderUsersTable(users) {
        const tbody = document.getElementById('usersTable');

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无用户</td></tr>';
            return;
        }

        const html = users.map(user => `
            <tr>
                <td>${user.cid || '<span style="color:#999;">未记录</span>'}</td>
                <td>${user.character_name || '-'}</td>
                <td>${user.world_name || '-'}</td>
                <td>${user.qq_info || '-'}</td>
                <td>${this.formatDate(user.first_login)}</td>
                <td>${this.formatDate(user.last_login)}</td>
                <td>${user.login_count || 0}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    /**
     * 加载审计日志
     */
    async loadLogs() {
        const action = document.getElementById('logActionFilter').value;

        try {
            this.showLoading(true);
            const response = await api.getLogs(100, 0, action);

            if (response.success) {
                this.renderLogsTable(response.logs || []);
            }
        } catch (error) {
            this.showToast(error.message || '加载日志失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染日志表格
     */
    renderLogsTable(logs) {
        const tbody = document.getElementById('logsTable');

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无日志</td></tr>';
            return;
        }

        const actionNames = {
            'user_submit': '用户提交',
            'user_verify': '用户验证',
            'admin_login': '管理员登录',
            'whitelist_add': '添加白名单',
            'whitelist_remove': '移除白名单'
        };

        const html = logs.map(log => `
            <tr>
                <td>${this.formatDate(log.timestamp)}</td>
                <td>${actionNames[log.action] || log.action}</td>
                <td class="text-truncate" title="${log.cid_hash || '-'}">${log.cid_hash || '-'}</td>
                <td>${log.ip_address || '-'}</td>
                <td class="text-truncate" title="${log.details || '-'}">${log.details || '-'}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        if (!dateString) return '-';

        try {
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    /**
     * 显示加载动画
     */
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    /**
     * 显示 Toast 通知
     */
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * 显示错误消息
     */
    showError(element, message) {
        element.textContent = message;
        element.classList.add('show');

        setTimeout(() => {
            element.classList.remove('show');
        }, 5000);
    }
}

// 初始化应用
const app = new App();
