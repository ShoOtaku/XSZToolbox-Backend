/**
 * 主应用逻辑
 */

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.usersCache = []; // 缓存用户列表用于查找
        this.logsCache = []; // 缓存日志列表用于详情显示
        this.whitelistCache = []; // 缓存白名单列表
        this.editingWhitelistHash = null;
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
        document.getElementById('findCharacterBtn')?.addEventListener('click', () => this.handleFindCharacter('newCid', 'newNote'));
        document.getElementById('editFindCharacterBtn')?.addEventListener('click', () => this.handleFindCharacter('editCid', 'editNote'));
        document.getElementById('whitelistTable')?.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const deleteBtn = target.closest('.whitelist-delete-btn');
            if (deleteBtn) {
                const cidHash = deleteBtn.dataset.cidHash;
                this.handleRemoveWhitelist(cidHash);
                return;
            }

            const row = target.closest('tr[data-index]');
            if (!row) return;
            const index = parseInt(row.dataset.index, 10);
            if (Number.isNaN(index)) return;
            this.showEditWhitelistModal(index);
        });

        // 日志过滤
        document.getElementById('logActionFilter')?.addEventListener('change', () => this.loadLogs());

        // 模态框事件
        document.getElementById('closeLogModal')?.addEventListener('click', () => this.closeLogDetailModal());
        document.getElementById('logDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'logDetailModal') {
                this.closeLogDetailModal();
            }
        });
        document.getElementById('copyCidHashBtn')?.addEventListener('click', () => this.copyCidHash());
        document.getElementById('closeEditWhitelistModal')?.addEventListener('click', () => this.hideEditWhitelistModal());
        document.getElementById('cancelEditWhitelistBtn')?.addEventListener('click', () => this.hideEditWhitelistModal());
        document.getElementById('editWhitelistModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'editWhitelistModal') {
                this.hideEditWhitelistModal();
            }
        });
        document.getElementById('saveWhitelistBtn')?.addEventListener('click', () => this.handleUpdateWhitelist());
        document.getElementById('deleteWhitelistBtn')?.addEventListener('click', () => this.handleDeleteFromEditModal());

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
            'whitelist_remove': '移除白名单',
            'whitelist_update': '更新白名单'
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
                this.whitelistCache = response.whitelist || [];
                this.renderWhitelistTable(this.whitelistCache);
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

        const html = whitelist.map((entry, index) => {
            // 确保 cid_hash 存在且有效
            const cidHash = entry.cid_hash || '';
            const canDelete = cidHash.length === 64; // SHA256 哈希长度为 64

            return `
            <tr class="whitelist-row" data-index="${index}">
                <td>${entry.cid || '<span style="color:#999;">未记录</span>'}</td>
                <td>${entry.note || '-'}</td>
                <td>${this.formatDate(entry.added_at)}</td>
                <td>${entry.added_by || '-'}</td>
                <td>
                    ${canDelete
                        ? `<button class="btn btn-danger btn-sm whitelist-delete-btn" data-cid-hash="${cidHash}">删除</button>`
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
            if (error.status === 409) {
                this.showToast('白名单已有该角色', 'warning');
            } else {
                this.showToast(error.message || '添加失败', 'error');
            }
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
            return false;
        }

        if (!confirm(`确定要移除该用户吗？\n\nCID 哈希: ${cidHash}`)) {
            return false;
        }

        try {
            this.showLoading(true);
            console.log('正在删除白名单:', cidHash);
            const response = await api.removeWhitelist(cidHash);

            if (response.success) {
                this.showToast('移除成功！', 'success');
                this.loadWhitelist();
                return true;
            } else {
                this.showToast(response.message || '移除失败', 'error');
                return false;
            }
        } catch (error) {
            console.error('删除白名单失败:', error);
            this.showToast(error.message || '移除失败', 'error');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 在编辑模态框中删除白名单
     */
    async handleDeleteFromEditModal() {
        if (!this.editingWhitelistHash) return;
        const deleted = await this.handleRemoveWhitelist(this.editingWhitelistHash);
        if (deleted) {
            this.hideEditWhitelistModal();
        }
    }

    /**
     * 显示编辑白名单模态框
     */
    showEditWhitelistModal(index) {
        const entry = this.whitelistCache[index];
        const modal = document.getElementById('editWhitelistModal');
        if (!entry || !modal) return;

        if (!entry.cid_hash || entry.cid_hash.length !== 64) {
            this.showToast('该条记录缺少有效哈希，无法编辑', 'error');
            return;
        }

        this.editingWhitelistHash = entry.cid_hash;

        document.getElementById('editCid').value = entry.cid || '';
        document.getElementById('editNote').value = entry.note || '';
        document.getElementById('editCidHash').textContent = entry.cid_hash;
        document.getElementById('editAddedBy').textContent = entry.added_by || '-';
        document.getElementById('editAddedAt').textContent = this.formatDate(entry.added_at) || '-';

        modal.classList.add('active');
    }

    /**
     * 隐藏编辑白名单模态框
     */
    hideEditWhitelistModal() {
        const modal = document.getElementById('editWhitelistModal');
        if (!modal) return;

        modal.classList.remove('active');
        this.editingWhitelistHash = null;

        document.getElementById('editCid').value = '';
        document.getElementById('editNote').value = '';
        document.getElementById('editCidHash').textContent = '-';
        document.getElementById('editAddedBy').textContent = '-';
        document.getElementById('editAddedAt').textContent = '-';
    }

    /**
     * 处理更新白名单
     */
    async handleUpdateWhitelist() {
        if (!this.editingWhitelistHash) {
            this.showToast('请选择要编辑的白名单', 'warning');
            return;
        }

        const cidInput = document.getElementById('editCid');
        const noteInput = document.getElementById('editNote');

        if (!cidInput || !noteInput) return;

        const cid = cidInput.value.trim();
        const note = noteInput.value.trim();

        if (!cid) {
            this.showToast('请输入 CID', 'error');
            return;
        }

        if (!/^\d+$/.test(cid)) {
            this.showToast('CID 必须是数字', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.updateWhitelist(this.editingWhitelistHash, {
                cid,
                note
            });

            if (response.success) {
                this.showToast('更新成功！', 'success');
                this.hideEditWhitelistModal();
                this.loadWhitelist();
            }
        } catch (error) {
            if (error.status === 409) {
                this.showToast('白名单已有该角色', 'warning');
            } else {
                this.showToast(error.message || '更新失败', 'error');
            }
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
                this.usersCache = response.users || []; // 缓存用户列表
                this.renderUsersTable(this.usersCache);
            }
        } catch (error) {
            this.showToast(error.message || '加载用户列表失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 查找角色并自动填充备注
     */
    async handleFindCharacter(cidInputId = 'newCid', noteInputId = 'newNote') {
        const cidInput = document.getElementById(cidInputId);
        const noteInput = document.getElementById(noteInputId);

        if (!cidInput || !noteInput) return;

        const cid = cidInput.value.trim();

        if (!cid) {
            this.showToast('请先输入 CID', 'warning');
            return;
        }

        // 验证 CID 格式
        if (!/^\d+$/.test(cid)) {
            this.showToast('CID 必须是数字', 'error');
            return;
        }

        // 如果缓存为空，先加载用户列表
        if (this.usersCache.length === 0) {
            try {
                this.showLoading(true);
                const response = await api.getUsers(100, 0);
                if (response.success) {
                    this.usersCache = response.users || [];
                }
            } catch (error) {
                this.showToast('加载用户列表失败', 'error');
                this.showLoading(false);
                return;
            } finally {
                this.showLoading(false);
            }
        }

        // 在缓存中查找用户
        const user = this.usersCache.find(u => u.cid === cid);

        if (user && user.character_name && user.world_name) {
            const note = `${user.character_name}@${user.world_name}`;
            noteInput.value = note;
            this.showToast(`✅ 找到角色：${note}`, 'success');
        } else {
            this.showToast('未找到该 CID 对应的角色信息', 'warning');
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

        // 调试日志：检查返回的用户数据
        console.log('用户列表数据:', users);
        console.log('第一个用户的 qq_info:', users[0]?.qq_info);

        const html = users.map(user => {
            // 格式化 QQ 号显示
            let qqDisplay = '-';
            if (user.qq_info) {
                // 如果包含多个QQ号（用 + 分隔），进行格式化
                if (user.qq_info.includes('+')) {
                    const qqList = user.qq_info.split('+').map(qq => qq.trim()).filter(qq => qq);
                    qqDisplay = `<div class="qq-list" title="${user.qq_info}">${qqList.join(' + ')}</div>`;
                } else {
                    qqDisplay = user.qq_info;
                }
            }

            return `
            <tr>
                <td>${user.cid || '<span style="color:#999;">未记录</span>'}</td>
                <td>${user.character_name || '-'}</td>
                <td>${user.world_name || '-'}</td>
                <td class="qq-cell">${qqDisplay}</td>
                <td>${this.formatDate(user.first_login)}</td>
                <td>${this.formatDate(user.last_login)}</td>
                <td>${user.login_count || 0}</td>
            </tr>
            `;
        }).join('');

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
                this.logsCache = response.logs || []; // 缓存日志数据
                this.renderLogsTable(this.logsCache);
            }
        } catch (error) {
            this.showToast(error.message || '加载日志失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染日志表格（添加点击事件）
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
            'whitelist_remove': '移除白名单',
            'whitelist_update': '更新白名单'
        };

        const html = logs.map((log, index) => `
            <tr class="log-row" data-log-index="${index}" style="cursor: pointer;">
                <td>${this.formatDate(log.timestamp)}</td>
                <td>${actionNames[log.action] || log.action}</td>
                <td class="text-truncate" title="${log.cid_hash || '-'}">${log.cid_hash || '-'}</td>
                <td>${log.ip_address || '-'}</td>
                <td class="text-truncate" title="${log.details || '-'}">${log.details || '-'}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;

        // 绑定点击事件
        tbody.querySelectorAll('.log-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.logIndex);
                this.showLogDetail(logs[index]);
            });
        });
    }

    /**
     * 显示日志详情模态框
     */
    showLogDetail(log) {
        const actionNames = {
            'user_submit': '用户提交',
            'user_verify': '用户验证',
            'admin_login': '管理员登录',
            'whitelist_add': '添加白名单',
            'whitelist_remove': '移除白名单',
            'whitelist_update': '更新白名单'
        };

        // 填充模态框数据
        document.getElementById('modalTimestamp').textContent = this.formatDate(log.timestamp);
        document.getElementById('modalAction').textContent = actionNames[log.action] || log.action;
        document.getElementById('modalCidHash').textContent = log.cid_hash || '无';
        document.getElementById('modalIpAddress').textContent = log.ip_address || '未记录';
        document.getElementById('modalDetails').textContent = log.details || '无';

        // 查找用户信息
        let userInfo = '未找到用户信息';
        if (log.cid_hash && this.usersCache.length > 0) {
            // 根据 CID 哈希查找用户（需要计算哈希或匹配）
            // 由于后端可能不返回完整映射，我们只能通过CID查找
            // 这里简化处理：如果日志包含用户信息则显示
            const user = this.usersCache.find(u => {
                // 尝试多种匹配方式
                return u.cid_hash === log.cid_hash || u.cid === log.cid_hash;
            });

            if (user && user.character_name && user.world_name) {
                userInfo = `${user.character_name}@${user.world_name}`;
            }
        }
        document.getElementById('modalUserInfo').textContent = userInfo;

        // 显示模态框
        document.getElementById('logDetailModal').classList.add('active');
    }

    /**
     * 关闭日志详情模态框
     */
    closeLogDetailModal() {
        document.getElementById('logDetailModal').classList.remove('active');
    }

    /**
     * 复制 CID 哈希
     */
    async copyCidHash() {
        const cidHash = document.getElementById('modalCidHash').textContent;

        if (cidHash === '无') {
            this.showToast('没有可复制的内容', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(cidHash);
            this.showToast('✅ CID 哈希已复制到剪贴板', 'success');
        } catch (error) {
            // 降级方案：使用旧API
            const textArea = document.createElement('textarea');
            textArea.value = cidHash;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('✅ CID 哈希已复制到剪贴板', 'success');
            } catch (err) {
                this.showToast('复制失败，请手动复制', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    /**
     * 格式化日期（后端时间为 GMT+0，这里统一转换为 GMT+8 展示）
     */
    formatDate(dateString) {
        if (!dateString) return '-';

        try {
            // 将无时区标记的时间视为 UTC，再转换为 GMT+8（Asia/Shanghai）
            let normalized = dateString;
            if (typeof dateString === 'string') {
                normalized = dateString.replace(' ', 'T');
                if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
                    normalized += 'Z';
                }
            }

            const date = new Date(normalized);
            if (Number.isNaN(date.getTime())) return dateString;

            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Shanghai'
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

// 初始化应用并暴露到全局，方便内联事件处理访问
const app = new App();
window.app = app;
