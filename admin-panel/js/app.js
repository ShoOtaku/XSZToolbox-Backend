/**
 * 服务器ID到名称的映射表
 */
const WORLD_NAMES = {
    161: '陆行鸟', 166: '莫古力', 168: '鲶鱼精', 190: '豆豆柴',
    1042: '拉诺西亚', 1043: '紫水栈桥', 1044: '幻影群岛', 1045: '摩杜纳',
    1060: '萌芽池', 1076: '白金幻象', 1081: '神意之地', 1106: '静语庄园',
    1113: '旅人栈桥', 1121: '拂晓之间', 1166: '龙巢神殿', 1167: '红玉海',
    1169: '延夏', 1170: '潮风亭', 1171: '神拳痕', 1172: '白银乡',
    1173: '宇宙和音', 1174: '沃仙曦染', 1175: '晨曦王座', 1176: '梦羽宝境',
    1177: '海猫茶屋', 1178: '柔风海湾', 1179: '琥珀原', 1180: '太阳海岸',
    1183: '银泪湖', 1186: '伊修加德', 1192: '水晶塔', 1200: '亚马乌罗提',
    1201: '红茶川'
};

/**
 * 根据服务器ID获取服务器名称
 */
function getWorldName(worldId) {
    return WORLD_NAMES[worldId] || worldId || '-';
}

/**
 * 填充服务器选择下拉列表
 */
function populateWorldSelects() {
    const selects = document.querySelectorAll('.world-select');
    const defaultOption = '<option value="">全部服务器</option>';
    const options = Object.entries(WORLD_NAMES)
        .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join('');
    selects.forEach(select => {
        select.innerHTML = defaultOption + options;
    });
}

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
        this.roomsCache = []; // 缓存房间列表
        this.currentRoomId = null; // 当前查看的房间ID
        this.logsPagination = { limit: 20, offset: 0, total: 0 };
        this.editingWhitelistHash = null;
        this.adminUsersCache = []; // 缓存管理员用户列表
        this.editingUserId = null; // 当前编辑的用户ID
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

        // 填充服务器下拉列表
        populateWorldSelects();

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

        // 房间管理
        document.getElementById('refreshRoomsBtn')?.addEventListener('click', () => this.loadRooms());
        document.getElementById('roomStatusFilter')?.addEventListener('change', () => this.loadRooms());
        document.getElementById('roomsTable')?.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            // 关闭按钮
            const closeBtn = target.closest('.room-close-btn');
            if (closeBtn) {
                const roomId = closeBtn.dataset.roomId;
                this.handleAdminCloseRoom(roomId);
                return;
            }

            // 点击行显示详情
            const row = target.closest('tr[data-room-index]');
            if (row) {
                const index = parseInt(row.dataset.roomIndex, 10);
                if (!Number.isNaN(index)) {
                    this.showRoomDetail(index);
                }
            }
        });

        // 房间详情模态框
        document.getElementById('closeRoomModal')?.addEventListener('click', () => this.closeRoomDetailModal());
        document.getElementById('cancelRoomModalBtn')?.addEventListener('click', () => this.closeRoomDetailModal());
        document.getElementById('roomDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'roomDetailModal') {
                this.closeRoomDetailModal();
            }
        });
        document.getElementById('modalCloseRoomBtn')?.addEventListener('click', () => this.handleCloseRoomFromModal());

        // 指令发送功能
        document.getElementById('commandTarget')?.addEventListener('change', (e) => this.handleCommandTargetChange(e));
        document.getElementById('sendCommandBtn')?.addEventListener('click', () => this.handleSendCommand());

        // 用户管理
        document.getElementById('createUserBtn')?.addEventListener('click', () => this.showCreateUserModal());
        document.getElementById('closeUserModal')?.addEventListener('click', () => this.hideUserModal());
        document.getElementById('cancelUserBtn')?.addEventListener('click', () => this.hideUserModal());
        document.getElementById('saveUserBtn')?.addEventListener('click', () => this.handleSaveUser());
        document.getElementById('deleteUserBtn')?.addEventListener('click', () => this.handleDeleteUser());
        document.getElementById('userModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'userModal') {
                this.hideUserModal();
            }
        });
        document.getElementById('userManagementTable')?.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            // 编辑按钮
            const editBtn = target.closest('.user-edit-btn');
            if (editBtn) {
                const userId = parseInt(editBtn.dataset.userId, 10);
                this.showEditUserModal(userId);
                return;
            }

            // 删除按钮
            const deleteBtn = target.closest('.user-delete-btn');
            if (deleteBtn) {
                const userId = parseInt(deleteBtn.dataset.userId, 10);
                this.handleDeleteUserFromTable(userId);
                return;
            }
        });

        // 账号设置
        document.getElementById('changeUsernameBtn')?.addEventListener('click', () => this.handleChangeUsername());
        document.getElementById('changePasswordBtn')?.addEventListener('click', () => this.handleChangePassword());

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
        
        // 根据用户角色渲染侧边栏
        this.renderSidebar();
        
        // 根据角色决定默认页面
        const role = authManager.getUserRole();
        const defaultPage = role === 'viewer' ? 'rooms' : 'dashboard';
        this.switchPage(defaultPage);
    }

    /**
     * 根据用户角色渲染侧边栏
     */
    renderSidebar() {
        const role = authManager.getUserRole();
        const sidebar = document.querySelector('.sidebar-nav');
        
        if (!sidebar) return;
        
        // 定义管理员菜单项
        const adminMenuItems = [
            { page: 'dashboard', icon: '📊', label: '仪表盘' },
            { page: 'whitelist', icon: '✅', label: '白名单管理' },
            { page: 'users', icon: '👥', label: '用户列表' },
            { page: 'lookup', icon: '🔍', label: '角色查询' },
            { page: 'players', icon: '🧙', label: '玩家信息' },
            { page: 'logs', icon: '📝', label: '审计日志' },
            { page: 'activity', icon: '📈', label: '活跃度统计' },
            { page: 'rooms', icon: '🚪', label: '房间管理' },
            { page: 'user-management', icon: '👤', label: '用户管理' },
            { page: 'account', icon: '⚙️', label: '账号设置' }
        ];
        
        // 定义普通用户菜单项
        const viewerMenuItems = [
            { page: 'rooms', icon: '🚪', label: '房间管理' },
            { page: 'account', icon: '⚙️', label: '账号设置' }
        ];
        
        // 根据角色选择菜单项
        const menuItems = role === 'admin' ? adminMenuItems : viewerMenuItems;
        
        // 渲染菜单
        sidebar.innerHTML = menuItems.map(item => `
            <a href="#" data-page="${item.page}" class="nav-item">
                <span class="icon">${item.icon}</span>
                <span>${item.label}</span>
            </a>
        `).join('');
        
        // 重新绑定导航事件
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.switchPage(page);
            });
        });
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

        // 将 kebab-case 转换为 camelCase (例如: user-management -> userManagement)
        const pageId = page.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        
        // 显示目标内容区域
        const targetContent = document.getElementById(`${pageId}Content`);
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
            case 'rooms':
                this.loadRooms();
                break;
            case 'user-management':
                this.loadUserManagement();
                break;
            case 'account':
                this.loadAccountSettings();
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
                        <td>${getWorldName(item.world_id)}</td>
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
                    <td>${getWorldName(stat.world_id)}</td>
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
                        <span class="table-title">${getWorldName(player.world_id)}</span>
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
                                <span class="table-title">${getWorldName(user.world_id)}</span>
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

    // ==================== 房间管理 ====================

    /**
     * 加载房间列表
     */
    async loadRooms() {
        const statusSelect = document.getElementById('roomStatusFilter');
        const status = statusSelect ? statusSelect.value : 'active';

        try {
            this.showLoading(true);
            const response = await api.getRooms(status, 100, 0);

            if (response.success) {
                this.roomsCache = response.rooms || [];
                this.renderRoomsTable(this.roomsCache, response.total || this.roomsCache.length);

                // 更新统计卡片
                document.getElementById('roomCount').textContent = response.total || 0;

                // 计算总在线人数
                const totalOnline = this.roomsCache.reduce((sum, room) => sum + (room.online_count || 0), 0);
                document.getElementById('totalOnlineMembers').textContent = totalOnline;
            }
        } catch (error) {
            this.showToast(error.message || '加载房间列表失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染房间列表表格
     */
    renderRoomsTable(rooms, total = 0) {
        const tbody = document.getElementById('roomsTable');
        const summary = document.getElementById('roomsSummary');
        if (!tbody) return;

        if (!rooms || rooms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">暂无房间数据</td></tr>';
            if (summary) {
                summary.textContent = `共 ${total || 0} 个房间`;
            }
            return;
        }

        // 获取用户角色
        const userRole = authManager.getUserRole();
        const isAdmin = userRole === 'admin';

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        const html = rooms.map((room, index) => {
            const roomCodeCell = `<span class="table-pill table-pill--id">${room.room_code}</span>`;
            const roomNameCell = room.room_name
                ? `<span class="table-title">${room.room_name}</span>`
                : placeholder('未命名');
            const hostCell = room.host_name
                ? `<div class="table-stack">
                        <span class="table-title">${room.host_name}</span>
                        ${room.host_world ? `<span class="table-meta">${room.host_world}</span>` : ''}
                   </div>`
                : placeholder('未知');
            const memberCell = `<span class="table-metric">${room.online_count || 0}/${room.member_count || 0}</span>`;

            // 状态显示
            let statusCell;
            if (room.status === 'closed') {
                statusCell = `<span class="table-pill" style="background: rgba(108, 117, 125, 0.15); color: #6c757d;">已关闭</span>`;
            } else if (room.is_published) {
                statusCell = `<span class="table-pill" style="background: rgba(40, 167, 69, 0.15); color: var(--success-color);">公开中</span>`;
            } else {
                statusCell = `<span class="table-pill" style="background: rgba(74, 144, 226, 0.12); color: var(--primary-color);">活跃</span>`;
            }

            // 操作按钮：只有管理员且房间活跃时才显示关闭按钮
            let actionContent;
            if (isAdmin && room.status === 'active') {
                actionContent = `<button class="btn btn-danger btn-sm room-close-btn" data-room-id="${room.id}">关闭</button>`;
            } else {
                actionContent = placeholder('-');
            }

            return `
            <tr class="table-row--clickable" data-room-index="${index}">
                <td>${roomCodeCell}</td>
                <td>${roomNameCell}</td>
                <td>${hostCell}</td>
                <td class="table-cell--metric">${memberCell}</td>
                <td>${statusCell}</td>
                <td>${formatDateCell(room.created_at)}</td>
                <td class="table-actions">${actionContent}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
        if (summary) {
            summary.textContent = `共 ${total} 个房间，显示 ${rooms.length} 条`;
        }
    }

    /**
     * 处理管理员关闭房间
     */
    async handleAdminCloseRoom(roomId) {
        if (!roomId) {
            this.showToast('无效的房间 ID', 'error');
            return;
        }

        const room = this.roomsCache.find(r => r.id === parseInt(roomId));
        const confirmMsg = room
            ? `确定要关闭房间 ${room.room_code} 吗？\n\n房间名称: ${room.room_name || '未命名'}\n房主: ${room.host_name || '未知'}`
            : `确定要关闭房间 ID: ${roomId} 吗？`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.adminCloseRoom(roomId);

            if (response.success) {
                this.showToast(`房间 ${response.roomCode || roomId} 已关闭`, 'success');
                this.loadRooms(); // 刷新列表
            } else {
                this.showToast(response.message || '关闭房间失败', 'error');
            }
        } catch (error) {
            this.showToast(error.message || '关闭房间失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 显示房间详情模态框
     */
    async showRoomDetail(index) {
        const room = this.roomsCache[index];
        if (!room) return;

        this.currentRoomId = room.id;

        // 获取用户角色
        const userRole = authManager.getUserRole();
        const isAdmin = userRole === 'admin';

        // 填充基本信息
        document.getElementById('modalRoomCode').textContent = room.room_code;
        document.getElementById('modalRoomName').textContent = room.room_name || '未命名';
        document.getElementById('modalRoomHost').textContent = room.host_name
            ? `${room.host_name}${room.host_world ? '@' + room.host_world : ''}`
            : '未知';
        document.getElementById('modalRoomStatus').textContent =
            room.status === 'closed' ? '已关闭' : (room.is_published ? '公开中' : '活跃');
        document.getElementById('modalRoomCreated').textContent = this.formatDate(room.created_at);
        document.getElementById('modalRoomExpires').textContent = this.formatDate(room.expires_at) || '无';
        document.getElementById('modalRoomPublished').textContent =
            room.is_published ? `是 (至 ${this.formatDate(room.publish_expires_at)})` : '否';

        // 更新关闭按钮状态：只有管理员且房间活跃时才显示
        const closeBtn = document.getElementById('modalCloseRoomBtn');
        if (closeBtn) {
            if (isAdmin && room.status === 'active') {
                closeBtn.disabled = false;
                closeBtn.style.display = '';
            } else {
                closeBtn.style.display = 'none';
            }
        }

        // 显示加载中
        document.getElementById('modalRoomMembers').innerHTML =
            '<tr><td colspan="5" class="table-empty">加载中...</td></tr>';

        // 显示模态框
        document.getElementById('roomDetailModal').classList.add('active');

        // 加载成员详情
        try {
            const response = await api.getRoomMembers(room.id);
            if (response.success) {
                this.renderMembersList(response.members || []);
            } else {
                document.getElementById('modalRoomMembers').innerHTML =
                    '<tr><td colspan="5" class="table-empty">加载成员失败</td></tr>';
            }
        } catch (error) {
            document.getElementById('modalRoomMembers').innerHTML =
                `<tr><td colspan="5" class="table-empty">加载失败: ${error.message}</td></tr>`;
        }

        // 加载指令历史
        this.loadCommandHistory(room.id);
    }

    /**
     * 加载指令历史
     * @param {number} roomId - 房间ID
     */
    async loadCommandHistory(roomId) {
        const historyContainer = document.getElementById('commandHistoryList');
        if (!historyContainer) return;

        // 显示加载中
        historyContainer.innerHTML = '<div class="table-empty">加载中...</div>';

        try {
            const response = await api.getRoomCommandHistory(roomId, 10);

            if (response.success) {
                this.renderCommandHistory(response.commands || []);
            } else {
                historyContainer.innerHTML = '<div class="table-empty">加载指令历史失败</div>';
            }
        } catch (error) {
            console.error('加载指令历史失败:', error);
            historyContainer.innerHTML = `<div class="table-empty">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染指令历史列表
     * @param {Array} commands - 指令列表
     */
    renderCommandHistory(commands) {
        const historyContainer = document.getElementById('commandHistoryList');
        if (!historyContainer) return;

        if (!commands || commands.length === 0) {
            historyContainer.innerHTML = '<div class="table-empty">暂无指令历史</div>';
            return;
        }

        // 限制显示最近 10 条
        const displayCommands = commands.slice(0, 10);

        const commandTypeNames = {
            'move': '移动',
            'jump': '跳跃',
            'setpos': '设置位置',
            'slidetp': '滑步传送',
            'lockpos': '锁定位置',
            'chat': '发送聊天',
            'echo': '回显',
            'stop': '停止'
        };

        const html = displayCommands.map(cmd => {
            const timestamp = this.formatDate(cmd.sent_at);
            const target = cmd.target_type === 'all' ? '所有成员' : (cmd.target_name || '指定成员');
            const commandType = commandTypeNames[cmd.command_type] || cmd.command_type;
            const status = cmd.status === 'sent' ? '已发送' : '失败';
            const statusClass = cmd.status === 'sent' ? 'success' : 'error';

            let statusBadge = `<span class="table-pill" style="background: rgba(40, 167, 69, 0.15); color: var(--success-color);">${status}</span>`;
            if (cmd.status === 'failed') {
                statusBadge = `<span class="table-pill" style="background: rgba(220, 53, 69, 0.15); color: var(--danger-color);">${status}</span>`;
            }

            let errorInfo = '';
            if (cmd.status === 'failed' && cmd.error) {
                errorInfo = `<div style="color: var(--danger-color); font-size: 12px; margin-top: 4px;">错误: ${cmd.error}</div>`;
            }

            return `
                <div class="command-history-item" style="padding: 12px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="table-meta" style="font-size: 12px;">${timestamp}</span>
                            <span class="table-pill table-pill--action">${commandType}</span>
                            ${statusBadge}
                        </div>
                        <span class="table-meta" style="font-size: 12px;">目标: ${target}</span>
                    </div>
                    ${errorInfo}
                </div>
            `;
        }).join('');

        historyContainer.innerHTML = html;
    }

    /**
     * 渲染成员列表
     */
    renderMembersList(members) {
        const tbody = document.getElementById('modalRoomMembers');
        if (!tbody) return;

        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无成员</td></tr>';
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;

        const roleNames = {
            'Host': '房主',
            'Leader': '队长',
            'Member': '成员'
        };

        // 获取用户角色
        const userRole = authManager.getUserRole();
        const isAdmin = userRole === 'admin';

        const html = members.map(member => {
            const nameCell = member.character_name
                ? `<span class="table-title">${member.character_name}</span>`
                : placeholder('-');
            const worldCell = member.world_name
                ? `<span class="table-meta">${member.world_name}</span>`
                : placeholder('-');
            
            // 职能标识下拉菜单（仅管理员可编辑）
            let jobRoleCell;
            if (isAdmin) {
                const jobRoleOptions = [
                    { value: '', label: '无' },
                    { value: 'MT', label: 'MT' },
                    { value: 'ST', label: 'ST' },
                    { value: 'H1', label: 'H1' },
                    { value: 'H2', label: 'H2' },
                    { value: 'D1', label: 'D1' },
                    { value: 'D2', label: 'D2' },
                    { value: 'D3', label: 'D3' },
                    { value: 'D4', label: 'D4' }
                ];
                const currentJobRole = member.job_role || '';
                const optionsHtml = jobRoleOptions.map(opt => 
                    `<option value="${opt.value}" ${opt.value === currentJobRole ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                jobRoleCell = `
                    <select class="job-role-select" 
                            data-room-id="${this.currentRoomId}" 
                            data-cid-hash="${member.cid_hash}"
                            data-original-value="${currentJobRole}">
                        ${optionsHtml}
                    </select>
                `;
            } else {
                jobRoleCell = member.job_role
                    ? `<span class="table-pill table-pill--id">${member.job_role}</span>`
                    : placeholder('-');
            }

            // 权限角色下拉菜单（仅管理员可编辑，房主不可修改）
            let roleCell;
            const isHost = member.role === 'Host';
            if (isAdmin && !isHost) {
                const roleOptions = [
                    { value: 'Leader', label: '队长' },
                    { value: 'Member', label: '成员' }
                ];
                const currentRole = member.role || 'Member';
                const roleOptionsHtml = roleOptions.map(opt => 
                    `<option value="${opt.value}" ${opt.value === currentRole ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                roleCell = `
                    <select class="permission-role-select" 
                            data-room-id="${this.currentRoomId}" 
                            data-cid-hash="${member.cid_hash}"
                            data-original-value="${currentRole}">
                        ${roleOptionsHtml}
                    </select>
                `;
            } else {
                roleCell = member.role
                    ? `<span class="table-meta table-meta--strong">${roleNames[member.role] || member.role}</span>`
                    : placeholder('-');
            }
            const statusCell = member.is_connected
                ? `<span class="table-pill" style="background: rgba(40, 167, 69, 0.15); color: var(--success-color);">在线</span>`
                : `<span class="table-pill" style="background: rgba(108, 117, 125, 0.15); color: #6c757d;">离线</span>`;

            return `
            <tr>
                <td>${nameCell}</td>
                <td>${worldCell}</td>
                <td>${jobRoleCell}</td>
                <td>${roleCell}</td>
                <td>${statusCell}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;

        // 绑定职能下拉菜单的 change 事件
        if (isAdmin) {
            tbody.querySelectorAll('.job-role-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const roomId = e.target.dataset.roomId;
                    const cidHash = e.target.dataset.cidHash;
                    const newJobRole = e.target.value || null;
                    const originalValue = e.target.dataset.originalValue;
                    this.handleJobRoleChange(roomId, cidHash, newJobRole, originalValue, e.target);
                });
            });

            // 绑定权限角色下拉菜单的 change 事件
            tbody.querySelectorAll('.permission-role-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const roomId = e.target.dataset.roomId;
                    const cidHash = e.target.dataset.cidHash;
                    const newRole = e.target.value;
                    const originalValue = e.target.dataset.originalValue;
                    this.handlePermissionRoleChange(roomId, cidHash, newRole, originalValue, e.target);
                });
            });
        }

        // 填充指令目标成员下拉菜单
        this.populateCommandTargetMembers(members);
    }

    /**
     * 填充指令目标成员下拉菜单
     * @param {Array} members - 成员列表
     */
    populateCommandTargetMembers(members) {
        const select = document.getElementById('commandTargetMember');
        if (!select || !members || members.length === 0) return;

        const options = members.map(member => {
            const name = member.character_name || '未知';
            const world = member.world_name ? `@${member.world_name}` : '';
            return `<option value="${member.cid_hash}">${name}${world}</option>`;
        }).join('');

        select.innerHTML = options;
    }

    /**
     * 处理目标类型变更
     * @param {Event} event - 变更事件
     */
    handleCommandTargetChange(event) {
        const targetType = event.target.value;
        const memberGroup = document.getElementById('commandTargetMemberGroup');
        
        if (memberGroup) {
            if (targetType === 'single') {
                memberGroup.style.display = '';
            } else {
                memberGroup.style.display = 'none';
            }
        }
    }

    /**
     * 验证指令参数格式
     * @param {string} params - 参数字符串
     * @returns {Object} 验证结果 { valid: boolean, error: string, parsed: Object }
     */
    validateCommandParams(params) {
        // 清空错误信息
        const errorElement = document.getElementById('commandParamsError');
        if (errorElement) {
            errorElement.textContent = '';
        }

        // 如果参数为空，返回空对象
        if (!params || params.trim() === '') {
            return { valid: true, error: null, parsed: {} };
        }

        try {
            // 尝试解析 JSON
            const parsed = JSON.parse(params);
            
            // 验证解析结果是否为对象
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                return {
                    valid: false,
                    error: '参数必须是有效的 JSON 对象',
                    parsed: null
                };
            }

            return { valid: true, error: null, parsed };
        } catch (error) {
            return {
                valid: false,
                error: `JSON 格式错误: ${error.message}`,
                parsed: null
            };
        }
    }

    /**
     * 处理指令发送
     */
    async handleSendCommand() {
        if (!this.currentRoomId) {
            this.showToast('未选择房间', 'error');
            return;
        }

        // 收集表单数据
        const targetTypeSelect = document.getElementById('commandTarget');
        const targetMemberSelect = document.getElementById('commandTargetMember');
        const commandTypeSelect = document.getElementById('commandType');
        const commandParamsTextarea = document.getElementById('commandParams');
        const errorElement = document.getElementById('commandParamsError');

        if (!targetTypeSelect || !commandTypeSelect || !commandParamsTextarea) {
            this.showToast('表单元素未找到', 'error');
            return;
        }

        const targetType = targetTypeSelect.value;
        const commandType = commandTypeSelect.value;
        const paramsText = commandParamsTextarea.value.trim();

        // 验证目标成员
        let targetCidHash = null;
        if (targetType === 'single') {
            if (!targetMemberSelect || !targetMemberSelect.value) {
                this.showToast('请选择目标成员', 'error');
                return;
            }
            targetCidHash = targetMemberSelect.value;
        }

        // 验证指令参数
        const validation = this.validateCommandParams(paramsText);
        if (!validation.valid) {
            if (errorElement) {
                errorElement.textContent = validation.error;
            }
            this.showToast(validation.error, 'error');
            return;
        }

        // 构造指令数据
        const commandData = {
            targetType: targetType,
            commandType: commandType,
            commandParams: validation.parsed
        };

        if (targetCidHash) {
            commandData.targetCidHash = targetCidHash;
        }

        try {
            this.showLoading(true);
            const response = await api.sendRoomCommand(this.currentRoomId, commandData);

            if (response.success) {
                this.showToast('指令发送成功', 'success');
                // 清空输入框
                commandParamsTextarea.value = '';
                if (errorElement) {
                    errorElement.textContent = '';
                }
                // 刷新指令历史
                if (this.currentRoomId) {
                    this.loadCommandHistory(this.currentRoomId);
                }
            } else {
                this.showToast(response.message || '指令发送失败', 'error');
            }
        } catch (error) {
            this.showToast(error.message || '指令发送失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理职能修改
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string|null} newJobRole - 新职能标识
     * @param {string} originalValue - 原始值
     * @param {HTMLSelectElement} selectElement - 下拉菜单元素
     */
    async handleJobRoleChange(roomId, cidHash, newJobRole, originalValue, selectElement) {
        if (!roomId || !cidHash) {
            this.showToast('参数错误', 'error');
            return;
        }

        try {
            // 禁用下拉菜单，防止重复操作
            selectElement.disabled = true;

            const response = await api.updateMemberJobRole(roomId, cidHash, newJobRole);

            if (response.success) {
                this.showToast('职能已更新', 'success');
                // 更新原始值，以便下次修改时使用
                selectElement.dataset.originalValue = newJobRole || '';
            } else {
                this.showToast(response.message || '更新失败', 'error');
                // 恢复原值
                selectElement.value = originalValue;
            }
        } catch (error) {
            this.showToast(error.message || '更新失败', 'error');
            // 恢复原值
            selectElement.value = originalValue;
        } finally {
            // 重新启用下拉菜单
            selectElement.disabled = false;
        }
    }

    /**
     * 处理权限修改
     * @param {number} roomId - 房间ID
     * @param {string} cidHash - 成员CID哈希
     * @param {string} newRole - 新权限角色
     * @param {string} originalValue - 原始值
     * @param {HTMLSelectElement} selectElement - 下拉菜单元素
     */
    async handlePermissionRoleChange(roomId, cidHash, newRole, originalValue, selectElement) {
        if (!roomId || !cidHash) {
            this.showToast('参数错误', 'error');
            return;
        }

        // 验证不能修改为房主
        if (newRole === 'Host') {
            this.showToast('不能将成员设置为房主', 'error');
            selectElement.value = originalValue;
            return;
        }

        try {
            // 禁用下拉菜单，防止重复操作
            selectElement.disabled = true;

            const response = await api.updateMemberRole(roomId, cidHash, newRole);

            if (response.success) {
                this.showToast('权限已更新', 'success');
                // 更新原始值，以便下次修改时使用
                selectElement.dataset.originalValue = newRole;
            } else {
                this.showToast(response.message || '更新失败', 'error');
                // 恢复原值
                selectElement.value = originalValue;
            }
        } catch (error) {
            this.showToast(error.message || '更新失败', 'error');
            // 恢复原值
            selectElement.value = originalValue;
        } finally {
            // 重新启用下拉菜单
            selectElement.disabled = false;
        }
    }

    /**
     * 关闭房间详情模态框
     */
    closeRoomDetailModal() {
        document.getElementById('roomDetailModal').classList.remove('active');
        this.currentRoomId = null;
    }

    /**
     * 从模态框关闭房间
     */
    async handleCloseRoomFromModal() {
        if (!this.currentRoomId) return;
        const roomId = this.currentRoomId;
        this.closeRoomDetailModal();
        await this.handleAdminCloseRoom(roomId);
    }

    // ==================== 用户管理 ====================

    /**
     * 加载用户管理页面
     */
    async loadUserManagement() {
        try {
            this.showLoading(true);
            const response = await api.getUserList({ limit: 100, offset: 0 });

            if (response.success) {
                this.adminUsersCache = response.users || [];
                this.renderUserManagementTable(this.adminUsersCache);
            } else {
                this.showToast(response.message || '加载用户列表失败', 'error');
            }
        } catch (error) {
            this.showToast(error.message || '加载用户列表失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染用户管理表格
     */
    renderUserManagementTable(users) {
        const tbody = document.getElementById('userManagementTable');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="table-empty">暂无用户</td></tr>';
            return;
        }

        const placeholder = (text = '-') => `<span class="table-placeholder">${text}</span>`;
        const formatDateCell = (value) => {
            const formatted = this.formatDate(value);
            return formatted === '-' ? placeholder('-') : `<span class="table-meta">${formatted}</span>`;
        };

        // 获取当前登录用户的ID（从 Token 中解析）
        const token = authManager.getToken();
        let currentUserId = null;
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                currentUserId = payload.id || payload.userId;
            } catch (error) {
                console.error('解析 Token 失败:', error);
            }
        }

        const roleNames = {
            'admin': '管理员',
            'viewer': '普通用户'
        };

        const html = users.map(user => {
            const usernameCell = `<span class="table-title">${user.username}</span>`;
            const roleCell = user.role
                ? `<span class="table-pill ${user.role === 'admin' ? 'table-pill--action' : ''}">${roleNames[user.role] || user.role}</span>`
                : placeholder('-');
            const loginCountCell = `<span class="table-metric">${user.login_count || 0}</span>`;

            // 判断是否是当前用户
            const isCurrentUser = currentUserId && user.id === currentUserId;

            // 操作按钮：不能删除自己
            const actionContent = isCurrentUser
                ? `<span class="table-placeholder">当前用户</span>`
                : `<button class="btn btn-primary btn-sm user-edit-btn" data-user-id="${user.id}">编辑</button>
                   <button class="btn btn-danger btn-sm user-delete-btn" data-user-id="${user.id}">删除</button>`;

            return `
            <tr>
                <td>${usernameCell}</td>
                <td>${roleCell}</td>
                <td>${formatDateCell(user.last_login)}</td>
                <td class="table-cell--metric">${loginCountCell}</td>
                <td>${formatDateCell(user.created_at)}</td>
                <td class="table-actions">${actionContent}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    /**
     * 显示创建用户模态框
     */
    showCreateUserModal() {
        this.editingUserId = null;

        // 设置标题
        document.getElementById('userModalTitle').textContent = '创建用户';

        // 清空表单
        document.getElementById('modalUsername').value = '';
        document.getElementById('modalPassword').value = '';
        document.getElementById('modalRole').value = 'viewer';

        // 清空错误提示
        document.getElementById('modalUsernameError').textContent = '';
        document.getElementById('modalPasswordError').textContent = '';

        // 隐藏删除按钮
        document.getElementById('deleteUserBtn').style.display = 'none';

        // 显示模态框
        document.getElementById('userModal').classList.add('active');
    }

    /**
     * 显示编辑用户模态框
     */
    showEditUserModal(userId) {
        const user = this.adminUsersCache.find(u => u.id === userId);
        if (!user) {
            this.showToast('用户不存在', 'error');
            return;
        }

        this.editingUserId = userId;

        // 设置标题
        document.getElementById('userModalTitle').textContent = '编辑用户';

        // 填充表单
        document.getElementById('modalUsername').value = user.username;
        document.getElementById('modalPassword').value = ''; // 密码留空
        document.getElementById('modalRole').value = user.role || 'viewer';

        // 清空错误提示
        document.getElementById('modalUsernameError').textContent = '';
        document.getElementById('modalPasswordError').textContent = '';

        // 显示删除按钮
        document.getElementById('deleteUserBtn').style.display = 'inline-block';

        // 显示模态框
        document.getElementById('userModal').classList.add('active');
    }

    /**
     * 隐藏用户模态框
     */
    hideUserModal() {
        document.getElementById('userModal').classList.remove('active');
        this.editingUserId = null;

        // 清空表单
        document.getElementById('modalUsername').value = '';
        document.getElementById('modalPassword').value = '';
        document.getElementById('modalRole').value = 'viewer';

        // 清空错误提示
        document.getElementById('modalUsernameError').textContent = '';
        document.getElementById('modalPasswordError').textContent = '';
    }

    /**
     * 处理保存用户（创建或更新）
     */
    async handleSaveUser() {
        // 清空错误提示
        document.getElementById('modalUsernameError').textContent = '';
        document.getElementById('modalPasswordError').textContent = '';

        const username = document.getElementById('modalUsername').value.trim();
        const password = document.getElementById('modalPassword').value.trim();
        const role = document.getElementById('modalRole').value;

        // 验证输入
        let hasError = false;

        if (!username) {
            document.getElementById('modalUsernameError').textContent = '请输入用户名';
            hasError = true;
        }

        // 创建模式下密码必填
        if (!this.editingUserId && !password) {
            document.getElementById('modalPasswordError').textContent = '请输入密码';
            hasError = true;
        }

        // 如果填写了密码，验证长度
        if (password && password.length < 8) {
            document.getElementById('modalPasswordError').textContent = '密码长度至少 8 个字符';
            hasError = true;
        }

        if (hasError) {
            return;
        }

        try {
            this.showLoading(true);

            if (this.editingUserId) {
                // 更新用户
                const updates = { username, role };
                if (password) {
                    updates.password = password;
                }

                const response = await api.updateUser(this.editingUserId, updates);

                if (response.success) {
                    this.showToast('用户信息已更新', 'success');
                    this.hideUserModal();
                    this.loadUserManagement();
                } else {
                    this.showToast(response.message || '更新失败', 'error');
                }
            } else {
                // 创建用户
                const response = await api.createUser(username, password, role);

                if (response.success) {
                    this.showToast('用户创建成功', 'success');
                    this.hideUserModal();
                    this.loadUserManagement();
                } else {
                    this.showToast(response.message || '创建失败', 'error');
                }
            }
        } catch (error) {
            if (error.status === 409) {
                document.getElementById('modalUsernameError').textContent = '用户名已存在';
            } else if (error.status === 400) {
                this.showToast(error.message || '输入数据无效', 'error');
            } else {
                this.showToast(error.message || '操作失败', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理删除用户（从模态框）
     */
    async handleDeleteUser() {
        if (!this.editingUserId) {
            this.showToast('请选择要删除的用户', 'error');
            return;
        }

        const user = this.adminUsersCache.find(u => u.id === this.editingUserId);
        const confirmMsg = user
            ? `确定要删除用户 "${user.username}" 吗？\n\n此操作不可恢复！`
            : `确定要删除该用户吗？\n\n此操作不可恢复！`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.deleteUser(this.editingUserId);

            if (response.success) {
                this.showToast('用户已删除', 'success');
                this.hideUserModal();
                this.loadUserManagement();
            } else {
                this.showToast(response.message || '删除失败', 'error');
            }
        } catch (error) {
            if (error.status === 403) {
                this.showToast('不能删除自己的账号', 'error');
            } else {
                this.showToast(error.message || '删除失败', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理从表格删除用户
     */
    async handleDeleteUserFromTable(userId) {
        const user = this.adminUsersCache.find(u => u.id === userId);
        const confirmMsg = user
            ? `确定要删除用户 "${user.username}" 吗？\n\n此操作不可恢复！`
            : `确定要删除该用户吗？\n\n此操作不可恢复！`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.deleteUser(userId);

            if (response.success) {
                this.showToast('用户已删除', 'success');
                this.loadUserManagement();
            } else {
                this.showToast(response.message || '删除失败', 'error');
            }
        } catch (error) {
            if (error.status === 403) {
                this.showToast('不能删除自己的账号', 'error');
            } else {
                this.showToast(error.message || '删除失败', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    // ==================== 账号设置 ====================

    /**
     * 加载账号设置页面
     */
    loadAccountSettings() {
        // 从 JWT Token 中获取当前用户名
        const token = authManager.getToken();
        if (!token) {
            this.showToast('未登录', 'error');
            return;
        }

        try {
            // 解析 JWT Token（简单解析，不验证签名）
            const payload = JSON.parse(atob(token.split('.')[1]));
            const username = payload.username || '未知';

            // 填充当前用户名
            const currentUsernameInput = document.getElementById('currentUsername');
            if (currentUsernameInput) {
                currentUsernameInput.value = username;
            }

            // 清空所有输入框和错误提示
            this.clearAccountSettingsForm();
        } catch (error) {
            console.error('解析 Token 失败:', error);
            this.showToast('获取用户信息失败', 'error');
        }
    }

    /**
     * 清空账号设置表单
     */
    clearAccountSettingsForm() {
        // 清空修改用户名表单
        document.getElementById('newUsername').value = '';
        document.getElementById('usernamePassword').value = '';
        document.getElementById('newUsernameError').textContent = '';
        document.getElementById('usernamePasswordError').textContent = '';

        // 清空修改密码表单
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('currentPasswordError').textContent = '';
        document.getElementById('newPasswordError').textContent = '';
        document.getElementById('confirmPasswordError').textContent = '';
    }

    /**
     * 处理修改用户名
     */
    async handleChangeUsername() {
        // 清空错误提示
        document.getElementById('newUsernameError').textContent = '';
        document.getElementById('usernamePasswordError').textContent = '';

        const newUsername = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('usernamePassword').value.trim();

        // 验证输入
        if (!newUsername) {
            document.getElementById('newUsernameError').textContent = '请输入新用户名';
            return;
        }

        if (!password) {
            document.getElementById('usernamePasswordError').textContent = '请输入当前密码';
            return;
        }

        // 确认操作
        if (!confirm(`确定要将用户名修改为 "${newUsername}" 吗？\n\n修改后需要重新登录。`)) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.changeUsername(newUsername, password);

            if (response.success) {
                this.showToast('用户名修改成功！请重新登录', 'success');
                
                // 延迟 2 秒后自动登出
                setTimeout(() => {
                    authManager.logout();
                }, 2000);
            } else {
                this.showToast(response.message || '修改失败', 'error');
            }
        } catch (error) {
            if (error.status === 401) {
                document.getElementById('usernamePasswordError').textContent = '密码错误';
            } else if (error.status === 409) {
                document.getElementById('newUsernameError').textContent = '用户名已存在';
            } else {
                this.showToast(error.message || '修改失败', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理修改密码
     */
    async handleChangePassword() {
        // 清空错误提示
        document.getElementById('currentPasswordError').textContent = '';
        document.getElementById('newPasswordError').textContent = '';
        document.getElementById('confirmPasswordError').textContent = '';

        const currentPassword = document.getElementById('currentPassword').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        // 验证输入
        let hasError = false;

        if (!currentPassword) {
            document.getElementById('currentPasswordError').textContent = '请输入当前密码';
            hasError = true;
        }

        if (!newPassword) {
            document.getElementById('newPasswordError').textContent = '请输入新密码';
            hasError = true;
        } else if (newPassword.length < 8) {
            document.getElementById('newPasswordError').textContent = '密码长度至少 8 个字符';
            hasError = true;
        }

        if (!confirmPassword) {
            document.getElementById('confirmPasswordError').textContent = '请确认新密码';
            hasError = true;
        } else if (newPassword !== confirmPassword) {
            document.getElementById('confirmPasswordError').textContent = '两次输入的密码不一致';
            hasError = true;
        }

        if (hasError) {
            return;
        }

        // 确认操作
        if (!confirm('确定要修改密码吗？\n\n修改后需要重新登录。')) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await api.changePassword(currentPassword, newPassword);

            if (response.success) {
                this.showToast('密码修改成功！请重新登录', 'success');
                
                // 延迟 2 秒后自动登出
                setTimeout(() => {
                    authManager.logout();
                }, 2000);
            } else {
                this.showToast(response.message || '修改失败', 'error');
            }
        } catch (error) {
            if (error.status === 401) {
                document.getElementById('currentPasswordError').textContent = '当前密码错误';
            } else if (error.status === 400) {
                // 可能是密码强度不足
                document.getElementById('newPasswordError').textContent = error.message || '密码不符合要求';
            } else {
                this.showToast(error.message || '修改失败', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }
}

// 初始化应用并暴露到全局，方便内联事件处理访问
const app = new App();
window.app = app;
