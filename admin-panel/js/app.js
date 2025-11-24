/**
 * 主应用逻辑
 */

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.usersCache = []; // 缓存用户列表用于查找
        this.logsCache = []; // 缓存日志列表用于详情显示
        this.whitelistCache = []; // 缓存白名单列表
        this.playersCache = []; // 缓存玩家信息
        this.logsPagination = { limit: 20, offset: 0, total: 0 };
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

        // 日志过滤 & 分页
        document.getElementById('logActionFilter')?.addEventListener('change', () => {
            this.resetLogsPagination();
            this.loadLogs();
        });
        document.getElementById('logPageSize')?.addEventListener('change', (event) => {
            const value = parseInt(event.target.value, 10);
            if (!Number.isNaN(value) && value > 0) {
                this.logsPagination.limit = value;
                this.resetLogsPagination();
                this.loadLogs();
            }
        });
        document.getElementById('logsPrevPage')?.addEventListener('click', () => this.changeLogsPage(-1));
        document.getElementById('logsNextPage')?.addEventListener('click', () => this.changeLogsPage(1));

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

        // 活跃度统计刷新
        document.getElementById('activityRefreshBtn')?.addEventListener('click', () => this.loadActivityStats());

        // 玩家信息
        document.getElementById('playersRefreshBtn')?.addEventListener('click', () => this.loadPlayers());

        // 角色查询工具
        document.getElementById('lookupSearchBtn')?.addEventListener('click', () => this.handleLookupSearch());
        document.getElementById('lookupResetBtn')?.addEventListener('click', () => {
            document.getElementById('lookupCharacterName').value = '';
            document.getElementById('lookupCid').value = '';
            document.getElementById('lookupWorldId').value = '';
            const tbody = document.getElementById('lookupResultTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" class="table-empty">请在上方输入条件后点击查询</td></tr>';
            }
        });

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
            case 'players':
                this.loadPlayers();
                break;
            case 'logs':
                this.loadLogs();
                break;
            case 'activity':
                this.loadActivityStats();
                break;
        }
    }

    /**
     * 加载活跃度统计页面数据
     */
    async loadActivityStats() {
        const worldIdInput = document.getElementById('activityWorldId');
        const daysInput = document.getElementById('activityDays');
        const worldId = worldIdInput && worldIdInput.value ? Number(worldIdInput.value) : undefined;
        const days = daysInput && daysInput.value ? Number(daysInput.value) : 7;

        try {
            this.showLoading(true);
            const resp = await api.getActivityStatistics({ worldId, days });

            if (!resp.success) {
                this.showToast(resp.message || '获取活跃度统计失败', 'error');
                return;
            }

            this.renderActivityStats(resp);
        } catch (error) {
            console.error('加载活跃度统计失败', error);
            this.showToast('加载活跃度统计失败，请稍后重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染活跃度统计数据
     */
    renderActivityStats(resp) {
        const leaderboardBody = document.getElementById('activityLeaderboardTable');
        const dailyBody = document.getElementById('activityDailyTable');
        const territoryBody = document.getElementById('activityTerritoryTable');

        const { statistics, query } = resp;

        // 排行榜（仅在 worldId 未指定时展示）
        if (statistics && statistics.leaderboard && Array.isArray(statistics.leaderboard)) {
            leaderboardBody.innerHTML = '';
            if (statistics.leaderboard.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="3" class="table-empty">暂无数据</td></tr>';
            } else {
                statistics.leaderboard.forEach((item) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.world_id}</td>
                        <td>${item.total_unique_players}</td>
                        <td>${item.total_encounters}</td>
                    `;
                    leaderboardBody.appendChild(tr);
                });
            }
        } else if (leaderboardBody) {
            // 当指定 worldId 时，排行榜可以简单显示该服务器汇总
            leaderboardBody.innerHTML = '';
            const stat = statistics;
            if (!stat || stat.total_unique_players === undefined) {
            leaderboardBody.innerHTML = '<tr><td colspan="3" class="table-empty">暂无数据</td></tr>';
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${stat.world_id}</td>
                    <td>${stat.total_unique_players}</td>
                    <td>${stat.total_encounters}</td>
                `;
                leaderboardBody.appendChild(tr);
            }
        }

        // 每日统计
        if (dailyBody) {
            dailyBody.innerHTML = '';
            const dailyStats = statistics && statistics.daily_stats
                ? statistics.daily_stats
                : (statistics && statistics.worlds && statistics.worlds.length > 0
                    ? statistics.worlds[0].daily_stats
                    : []);

            if (!dailyStats || dailyStats.length === 0) {
                dailyBody.innerHTML = '<tr><td colspan="3" class="table-empty">暂无每日统计数据</td></tr>';
            } else {
                dailyStats.forEach((d) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${d.date}</td>
                        <td>${d.unique_players}</td>
                        <td>${d.total_encounters}</td>
                    `;
                    dailyBody.appendChild(tr);
                });
            }
        }

        // 热门地图：只有在指定 worldId 时才有
        if (territoryBody) {
            territoryBody.innerHTML = '';
            const territories = statistics && statistics.top_territories ? statistics.top_territories : [];

            if (!query.world_id) {
                territoryBody.innerHTML = '<tr><td colspan="3" class="table-empty">请在上方输入服务器 ID 后刷新</td></tr>';
            } else if (territories.length === 0) {
            territoryBody.innerHTML = '<tr><td colspan="3" class="table-empty">暂无地图统计数据</td></tr>';
            } else {
                territories.forEach((t) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${t.territory_id}</td>
                        <td>${t.unique_players}</td>
                        <td>${t.encounters}</td>
                    `;
                    territoryBody.appendChild(tr);
                });
            }
        }
    }

    /**
     * 加载玩家信息总览
     */
    async loadPlayers() {
        const worldInput = document.getElementById('playersWorldId');
        const searchInput = document.getElementById('playersSearch');
        const limitInput = document.getElementById('playersLimit');

        const worldValue = worldInput && worldInput.value ? worldInput.value.trim() : '';
        let worldId;
        if (worldValue) {
            worldId = Number(worldValue);
            if (Number.isNaN(worldId)) {
                this.showToast('服务器 ID 必须为数字', 'error');
                return;
            }
        }

        let limit = limitInput && limitInput.value ? parseInt(limitInput.value, 10) : 200;
        if (Number.isNaN(limit) || limit <= 0) limit = 200;
        limit = Math.min(Math.max(limit, 10), 500);

        const search = searchInput && searchInput.value ? searchInput.value.trim() : '';

        try {
            this.showLoading(true);
            const response = await api.getActivityPlayers({
                worldId,
                search: search || undefined,
                limit
            });

            if (!response.success) {
                this.showToast(response.message || '加载玩家信息失败', 'error');
                return;
            }

            this.playersCache = response.players || [];
            this.renderPlayersTable(this.playersCache, response.total || this.playersCache.length);
        } catch (error) {
            this.showToast(error.message || '加载玩家信息失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染玩家信息表格
     */
    renderPlayersTable(players, total = 0) {
        const tbody = document.getElementById('playersTable');
        const summary = document.getElementById('playersSummary');
        if (!tbody) return;

        if (!players || players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">暂无玩家数据</td></tr>';
            if (summary) {
                summary.textContent = `共 ${total || 0} 名玩家`;
            }
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        const rows = players.map(player => {
            const cidCell = player.content_id
                ? `<span class="table-pill table-pill--id">${player.content_id}</span>`
                : placeholder('-');
            const nameCell = player.character_name
                ? `<span class="table-title">${player.character_name}</span>`
                : placeholder('-');
            const worldCell = player.world_id || player.world_name
                ? `<div class="table-stack">
                        <span class="table-title">${player.world_id ?? '-'}</span>
                        ${player.world_name ? `<span class="table-meta">${player.world_name}</span>` : ''}
                   </div>`
                : placeholder('-');

            return `
            <tr>
                <td>${cidCell}</td>
                <td>${nameCell}</td>
                <td>${worldCell}</td>
                <td class="table-cell--metric"><span class="table-metric">${player.encounter_count || 0}</span></td>
                <td class="table-cell--metric"><span class="table-metric">${player.unique_uploaders || 0}</span></td>
                <td>${formatDateCell(player.first_seen)}</td>
                <td>${formatDateCell(player.last_seen)}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
        if (summary) {
            summary.textContent = `共 ${total} 名玩家，显示 ${players.length} 条`;
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
        if (!tbody) return;

        if (whitelist.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无白名单</td></tr>';
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        const html = whitelist.map((entry, index) => {
            // 确保 cid_hash 存在且有效
            const cidHash = entry.cid_hash || '';
            const canDelete = cidHash.length === 64; // SHA256 哈希长度为 64
            const cidDisplay = entry.cid
                ? `<span class="table-pill table-pill--id">${entry.cid}</span>`
                : placeholder('未记录');
            const noteDisplay = entry.note
                ? `<div class="table-note">${entry.note}</div>`
                : placeholder('暂无备注');
            const addedByDisplay = entry.added_by
                ? `<span class="table-meta table-meta--strong">${entry.added_by}</span>`
                : placeholder('-');
            const actionContent = canDelete
                ? `<button class="btn btn-danger btn-sm whitelist-delete-btn" data-cid-hash="${cidHash}">删除</button>`
                : placeholder('无法删除');

            return `
            <tr class="whitelist-row table-row--clickable" data-index="${index}">
                <td>${cidDisplay}</td>
                <td>${noteDisplay}</td>
                <td>${formatDateCell(entry.added_at)}</td>
                <td>${addedByDisplay}</td>
                <td class="table-actions">
                    ${actionContent}
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
            const response = await api.getUsers({ limit: 100, offset: 0 });

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
     * 处理用户查询（通过角色名或 CID）
     */
    async handleLookupSearch() {
        const nameInput = document.getElementById('lookupCharacterName');
        const cidInput = document.getElementById('lookupCid');
        const worldInput = document.getElementById('lookupWorldId');

        const characterName = nameInput ? nameInput.value.trim() : '';
        const cid = cidInput ? cidInput.value.trim() : '';
        const worldIdValue = worldInput ? worldInput.value.trim() : '';
        let worldId;
        if (worldIdValue) {
            worldId = Number(worldIdValue);
            if (Number.isNaN(worldId)) {
                this.showToast('服务器 ID 必须为数字', 'error');
                return;
            }
        }

        if (!characterName && !cid) {
            this.showToast('请至少输入角色名或 CID 之一进行查询', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.getActivityPlayers({
                worldId,
                search: characterName || undefined,
                cid: cid || undefined,
                limit: 100
            });

            if (response.success) {
                const players = response.players || [];
                this.renderLookupTable(players);

                if (players.length === 0) {
                    this.showToast('未找到匹配的玩家', 'info');
                } else {
                    this.showToast(`找到 ${players.length} 条匹配记录`, 'success');
                }
            } else {
                this.showToast(response.message || '查询失败', 'error');
            }
        } catch (error) {
            this.showToast(error.message || '查询失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染角色查询结果表格
     */
    renderLookupTable(users) {
        const tbody = document.getElementById('lookupResultTable');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">未找到匹配的玩家</td></tr>';
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        const html = users.map(user => `
            <tr>
                <td>${user.content_id ? `<span class="table-pill table-pill--id">${user.content_id}</span>` : placeholder('-')}</td>
                <td>${user.character_name ? `<span class="table-title">${user.character_name}</span>` : placeholder('-')}</td>
                <td>
                    ${(user.world_id || user.world_name)
                        ? `<div class="table-stack">
                                <span class="table-title">${user.world_id || '-'}</span>
                                ${user.world_name ? `<span class="table-meta">${user.world_name}</span>` : ''}
                           </div>`
                        : placeholder('-')}
                </td>
                <td class="table-cell--metric"><span class="table-metric">${user.encounter_count || 0}</span></td>
                <td class="table-cell--metric"><span class="table-metric">${user.unique_uploaders || 0}</span></td>
                <td>${formatDateCell(user.first_seen)}</td>
                <td>${formatDateCell(user.last_seen)}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
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
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">暂无用户</td></tr>';
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        const html = users.map(user => {
            // 格式化 QQ 号显示
            let qqDisplay = placeholder('-');
            if (user.qq_info) {
                // 如果包含多个QQ号（用 + 分隔），进行格式化
                if (user.qq_info.includes('+')) {
                    const qqList = user.qq_info.split('+').map(qq => qq.trim()).filter(qq => qq);
                    qqDisplay = `
                        <div class="table-stack" title="${user.qq_info}">
                            <span class="table-title">${qqList.join(' + ')}</span>
                            <span class="table-meta">共 ${qqList.length} 个 QQ</span>
                        </div>
                    `;
                } else {
                    qqDisplay = `<span class="table-title">${user.qq_info}</span>`;
                }
            }

            return `
            <tr>
                <td>${user.cid ? `<span class="table-pill table-pill--id">${user.cid}</span>` : placeholder('未记录')}</td>
                <td>${user.character_name ? `<span class="table-title">${user.character_name}</span>` : placeholder('-')}</td>
                <td>
                    ${(user.world_name || user.world_id)
                        ? `<div class="table-stack">
                                <span class="table-title">${user.world_name || '未知服务器'}</span>
                                ${user.world_id ? `<span class="table-meta">ID: ${user.world_id}</span>` : ''}
                           </div>`
                        : placeholder('-')}
                </td>
                <td class="qq-cell">${qqDisplay}</td>
                <td>${formatDateCell(user.first_login)}</td>
                <td>${formatDateCell(user.last_login)}</td>
                <td><span class="table-pill table-pill--count">${user.login_count || 0} 次</span></td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    /**
     * 加载审计日志
     */
    async loadLogs(options = {}) {
        const actionSelect = document.getElementById('logActionFilter');
        const action = actionSelect ? actionSelect.value : '';
        if (options.resetOffset) {
            this.resetLogsPagination();
        }

        const pageSizeSelect = document.getElementById('logPageSize');
        if (pageSizeSelect) {
            const size = parseInt(pageSizeSelect.value, 10);
            if (!Number.isNaN(size) && size > 0) {
                this.logsPagination.limit = size;
            }
        }

        const { limit } = this.logsPagination;
        let { offset } = this.logsPagination;

        try {
            this.showLoading(true);
            const response = await api.getLogs(limit, offset, action);

            if (response.success) {
                const total = typeof response.total === 'number' ? response.total : 0;
                const logs = response.logs || [];

                // 如果当前页没有数据但仍有总数，自动回退到最后一页
                if (total > 0 && logs.length === 0 && offset >= total) {
                    const lastPageOffset = Math.max(0, (Math.ceil(total / limit) - 1) * limit);
                    if (lastPageOffset !== offset) {
                        this.logsPagination.offset = lastPageOffset;
                        await this.loadLogs();
                        return;
                    }
                }

                this.logsCache = logs; // 缓存日志数据
                this.logsPagination.total = total;
                this.logsPagination.limit = response.limit || limit;
                this.logsPagination.offset = response.offset ?? offset;
                this.renderLogsTable(this.logsCache);
                this.updateLogsPaginationUI();
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
        if (!tbody) return;

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无日志</td></tr>';
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
        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const resolveCharacter = (log) => {
            // 优先使用日志自带的角色信息
            const character = log.character_name || log.character;
            const world = log.world_name || log.world_id;
            if (character && world) return `${character}@${world}`;
            if (character) return character;

            // 尝试通过缓存的用户列表匹配
            if (log.cid_hash && this.usersCache && this.usersCache.length > 0) {
                const matched = this.usersCache.find(u => u.cid_hash === log.cid_hash || u.cid === log.cid_hash);
                if (matched && matched.character_name && (matched.world_name || matched.world_id)) {
                    return `${matched.character_name}@${matched.world_name || matched.world_id}`;
                }
            }
            return null;
        };

        const html = logs.map((log, index) => `
            <tr class="log-row table-row--clickable" data-log-index="${index}">
                <td>
                    ${(() => {
                        const formatted = this.formatDate(log.timestamp);
                        if (formatted === '-') return placeholder('-');
                        return `
                            <div class="table-stack">
                                <span class="table-title">${formatted}</span>
                                ${log.username ? `<span class="table-meta">操作者：${log.username}</span>` : ''}
                            </div>
                        `;
                    })()}
                </td>
                <td>${log.action ? `<span class="table-pill table-pill--action">${actionNames[log.action] || log.action}</span>` : placeholder('-')}</td>
                <td>
                    ${(() => {
                        const label = resolveCharacter(log);
                        if (label) {
                            return `<span class="table-title text-truncate" title="${label}">${label}</span>`;
                        }
                        return log.cid_hash
                            ? `<div class="text-truncate" title="${log.cid_hash}"><span class="table-code">${log.cid_hash}</span></div>`
                            : placeholder('-');
                    })()}
                </td>
                <td>${log.ip_address ? `<span class="table-meta table-meta--strong">${log.ip_address}</span>` : placeholder('-')}</td>
                <td>
                    ${log.details
                        ? `<div class="table-stack">
                                <span class="table-title text-truncate" title="${log.details}">${log.details}</span>
                           </div>`
                        : placeholder('-')}
                </td>
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
     * 更新日志分页信息与按钮状态
     */
    updateLogsPaginationUI() {
        const info = document.getElementById('logsPaginationInfo');
        const prevBtn = document.getElementById('logsPrevPage');
        const nextBtn = document.getElementById('logsNextPage');
        const pageSizeSelect = document.getElementById('logPageSize');

        const logsLength = this.logsCache ? this.logsCache.length : 0;
        const { limit, offset } = this.logsPagination;
        const totalRaw = this.logsPagination.total;
        const totalCount = (typeof totalRaw === 'number' && totalRaw > 0) ? totalRaw : logsLength;
        const hasRows = logsLength > 0;

        if (pageSizeSelect && pageSizeSelect.value !== String(limit)) {
            pageSizeSelect.value = String(limit);
        }

        if (info) {
            if (totalCount > 0 && hasRows) {
                const totalPages = Math.max(1, Math.ceil(totalCount / limit));
                const currentPage = Math.min(totalPages, Math.floor(offset / limit) + 1);
                const start = Math.min(totalCount, offset + 1);
                const end = Math.min(totalCount, offset + logsLength);
                info.textContent = `第 ${currentPage} / ${totalPages} 页 · 显示 ${start}-${end} 条 · 共 ${totalCount} 条`;
            } else if (totalCount > 0) {
                info.textContent = `共 ${totalCount} 条记录`;
            } else {
                info.textContent = '暂无日志记录';
            }
        }

        if (prevBtn) {
            prevBtn.disabled = offset <= 0 || !hasRows;
        }
        if (nextBtn) {
            if (!hasRows || totalCount === 0) {
                nextBtn.disabled = true;
            } else {
                nextBtn.disabled = offset + logsLength >= totalCount;
            }
        }
    }

    /**
     * 翻页
     */
    changeLogsPage(direction) {
        if (!direction) return;
        const { limit } = this.logsPagination;
        let { offset } = this.logsPagination;
        const totalRaw = this.logsPagination.total;
        const totalCount = (typeof totalRaw === 'number' && totalRaw > 0)
            ? totalRaw
            : offset + (this.logsCache ? this.logsCache.length : 0);

        if (direction < 0 && offset <= 0) return;

        let newOffset = offset + direction * limit;
        if (newOffset < 0) newOffset = 0;

        if (totalCount > 0) {
            const maxOffset = Math.max(0, (Math.ceil(totalCount / limit) - 1) * limit);
            if (newOffset > maxOffset) newOffset = maxOffset;
        }

        if (newOffset === offset) return;
        this.logsPagination.offset = newOffset;
        this.loadLogs();
    }

    /**
     * 重置日志分页
     */
    resetLogsPagination() {
        this.logsPagination.offset = 0;
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
