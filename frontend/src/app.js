// ModelScope Balancer Admin Panel JavaScript

class AdminApp {
    constructor() {
        this.currentPage = '';
        this.models = [];
        this.keys = [];
        this.isLoading = false;
        this.testInProgress = false;
        this.adminToken = null; // 用于在内存中缓存令牌
        this.checkAuth();
    }

    async checkAuth() {
        // 尝试从localStorage读取已保存的令牌
        const savedToken = localStorage.getItem('adminToken');

        console.log('Checking auth, saved token:', savedToken ? 'exists' : 'not found');

        if (savedToken) {
            // 如果有保存的令牌，验证其有效性
            console.log('Validating saved token...');

            try {
                const response = await fetch('/admin/api/keys', {
                    headers: {
                        'Authorization': `Bearer ${savedToken}`
                    }
                });

                if (response.ok) {
                    // 令牌有效，使用并初始化应用
                    console.log('Saved token is valid, initializing app');
                    this.adminToken = savedToken;
                    this.init();
                } else {
                    // 令牌无效，清除并显示认证界面
                    console.log('Saved token is invalid, clearing and showing auth prompt');
                    localStorage.removeItem('adminToken');
                    this.renderAuthPrompt();
                }
            } catch (error) {
                // 网络错误，假设令牌可能有效，但显示警告
                console.error('Error validating token:', error);
                console.log('Network error during validation, proceeding with saved token');
                this.adminToken = savedToken;
                this.init();
                this.showNotification('网络连接异常，部分功能可能不可用', 'warning');
            }
        } else {
            // 如果没有令牌，显示认证界面
            console.log('No saved token, showing auth prompt');
            this.renderAuthPrompt();
        }
    }

    init() {
        // Initialize routing
        this.setupRouting();

        // Load initial page
        this.handleRoute();

        // Setup navigation
        this.setupNavigation();

        // Setup logout functionality
        this.setupLogout();
    }

    setupRouting() {
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.nav-link').forEach(l => {
                    l.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
                    l.classList.add('text-gray-600');
                });
                const activeLink = e.target.closest('.nav-link');
                activeLink.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
                activeLink.classList.remove('text-gray-600');
            });
        });
    }

    renderAuthPrompt() {
        console.log('renderAuthPrompt called');
        // 获取主内容区域
        const mainContent = document.getElementById('main-content');

        if (!mainContent) {
            console.error('main-content element not found!');
            return;
        }

        console.log('Rendering auth prompt...');

        // 清空现有内容并显示认证界面
        mainContent.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div class="max-w-md w-full space-y-8 p-8">
                    <div class="text-center">
                        <div class="mx-auto h-16 w-16 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 mb-6">
                            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                        </div>
                        <h2 class="text-3xl font-bold text-gray-900 mb-2">管理员认证</h2>
                        <p class="text-gray-600">请输入管理员令牌以访问控制面板</p>
                    </div>

                    <div class="bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 shadow-xl shadow-black/5 p-8">
                        <div class="space-y-6">
                            <div>
                                <label for="admin-token" class="block text-sm font-medium text-gray-700 mb-2">
                                    管理员令牌
                                </label>
                                <input
                                    type="password"
                                    id="admin-token"
                                    placeholder="请输入管理员令牌"
                                    class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 backdrop-blur-sm"
                                    autocomplete="off"
                                />
                            </div>

                            <button
                                id="auth-submit"
                                class="w-full bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 text-white font-medium py-3 px-6 rounded-xl hover:from-blue-600 hover:via-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                            >
                                进入管理面板
                            </button>
                        </div>
                    </div>

                    <div class="text-center">
                        <p class="text-xs text-gray-500">
                            ModelScope Balancer 管理面板
                        </p>
                    </div>
                </div>
            </div>
        `;

        // 为进入按钮添加事件监听器
        const submitButton = document.getElementById('auth-submit');
        const tokenInput = document.getElementById('admin-token');

        const handleAuth = async () => {
            const token = tokenInput.value.trim();

            if (!token) {
                this.showNotification('请输入管理员令牌', 'error');
                return;
            }

            // 显示验证中状态
            submitButton.disabled = true;
            submitButton.textContent = '验证中...';

            try {
                // 验证令牌有效性
                const response = await fetch('/admin/api/keys', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    // 令牌无效
                    this.showNotification('令牌无效，请检查后重试', 'error');
                    submitButton.disabled = false;
                    submitButton.textContent = '进入管理面板';
                    tokenInput.focus();
                    return;
                }

                // 令牌有效，保存并进入主界面
                localStorage.setItem('adminToken', token);
                this.adminToken = token;

                // 清空主内容区
                mainContent.innerHTML = '';

                // 重新登录后默认进入密钥管理页面
                window.location.hash = '#keys';

                // 重新初始化应用
                this.init();

                this.showNotification('认证成功，欢迎使用管理面板！', 'success');

            } catch (error) {
                console.error('Authentication error:', error);
                this.showNotification('网络错误，请稍后重试', 'error');
                submitButton.disabled = false;
                submitButton.textContent = '进入管理面板';
            }
        };

        submitButton.addEventListener('click', handleAuth);

        // 支持回车键提交
        tokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuth();
            }
        });

        // 自动聚焦到输入框
        setTimeout(() => tokenInput.focus(), 100);
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    logout() {
        // 清除localStorage中的令牌
        localStorage.removeItem('adminToken');

        // 清除内存中的令牌
        this.adminToken = null;

        // 清除当前页面状态
        this.currentPage = null;

        // 清除URL hash，确保重新登录时进入默认页面
        window.location.hash = '';

        // 显示退出成功消息
        this.showNotification('已安全退出登录', 'success');

        // 重新显示认证界面
        this.renderAuthPrompt();
    }

    handleRoute() {
        // 如果没有认证token，不处理路由
        if (!this.adminToken) {
            console.log('No admin token, skipping route handling');
            return;
        }

        const hash = window.location.hash.slice(1) || 'keys';

        if (hash !== this.currentPage) {
            this.currentPage = hash;
            this.renderPage(hash);
        }
    }

    renderPage(page) {
        const mainContent = document.getElementById('main-content');

        switch (page) {
            case 'keys':
                this.renderKeysPage();
                break;
            case 'test':
                this.renderTestPage();
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
            default:
                this.renderKeysPage();
        }
    }

    renderKeysPage() {
        const template = document.getElementById('keys-template');
        const clone = template.content.cloneNode(true);

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        mainContent.appendChild(clone);

        // Setup event listeners
        this.setupKeysPageEvents();

        // Load keys data
        this.loadKeys();
    }

    setupKeysPageEvents() {
        // Add key button
        const addBtn = document.getElementById('add-key-btn');
        const keyInput = document.getElementById('new-key-input');

        addBtn.addEventListener('click', () => this.addKey());
        keyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addKey();
        });
    }

    async loadKeys() {
        // 确保有认证token
        if (!this.adminToken) {
            console.log('No admin token available, cannot load keys');
            return;
        }

        this.showKeysLoading(true);

        try {
            const response = await fetch('/admin/api/keys', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });
            if (!response.ok) throw new Error('Failed to load keys');

            this.keys = await response.json();
            this.updateLastUpdated();
            this.renderKeysTable();
        } catch (error) {
            console.error('Error loading keys:', error);
            this.showError('加载密钥失败: ' + error.message);
            this.showKeysEmpty();
        } finally {
            this.showKeysLoading(false);
        }
    }

    showKeysLoading(show) {
        const loading = document.getElementById('keys-loading');
        const empty = document.getElementById('keys-empty');
        const table = document.getElementById('keys-table-container');

        if (show) {
            loading?.classList.remove('hidden');
            empty?.classList.add('hidden');
            table?.classList.add('hidden');
        } else {
            loading?.classList.add('hidden');
        }
    }

    showKeysEmpty() {
        const loading = document.getElementById('keys-loading');
        const empty = document.getElementById('keys-empty');
        const table = document.getElementById('keys-table-container');

        loading?.classList.add('hidden');
        empty?.classList.remove('hidden');
        table?.classList.add('hidden');
    }

    updateLastUpdated() {
        const lastUpdated = document.getElementById('last-updated');
        if (lastUpdated) {
            lastUpdated.textContent = `最后更新: ${new Date().toLocaleString('zh-CN')}`;
        }
    }

    updateKeysCount() {
        const keysCount = document.getElementById('keys-count');
        if (keysCount) {
            keysCount.textContent = `${this.keys.length} 个密钥`;
        }
    }

    renderKeysTable() {
        const grid = document.getElementById('keys-grid');
        const loading = document.getElementById('keys-loading');
        const empty = document.getElementById('keys-empty');
        const container = document.getElementById('keys-table-container');

        if (!grid) return;

        if (this.keys.length === 0) {
            this.showKeysEmpty();
            return;
        }

        // Show grid and hide other states
        loading?.classList.add('hidden');
        empty?.classList.add('hidden');
        container?.classList.remove('hidden');

        grid.innerHTML = '';
        this.updateKeysCount();

        this.keys.forEach(key => {
            const card = this.createKeyCard(key);
            grid.appendChild(card);
        });
    }

    createKeyCard(key) {
        const card = document.createElement('div');
        card.className = 'group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-300 overflow-hidden';

        const isActive = key.status === 'active';

        // Enhanced status indicator with background
        const statusIndicator = isActive
            ? `<div class="inline-flex items-center space-x-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                 <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                 <span class="text-xs font-semibold text-green-700">ACTIVE</span>
               </div>`
            : `<div class="inline-flex items-center space-x-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                 <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                 <span class="text-xs font-semibold text-red-700">DISABLED</span>
               </div>`;

        const disabledAt = key.disabled_at && key.disabled_at !== '0001-01-01T00:00:00Z'
            ? this.formatDateTime(key.disabled_at)
            : null;

        // Enhanced action buttons with better styling
        const actionButtons = isActive ? `
            <button onclick="app.disableKey('${key.value}')"
                    class="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                禁用
            </button>
            <button onclick="app.deleteKey('${key.value}')"
                    class="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                删除
            </button>
        ` : `
            <button onclick="app.reactivateKey('${key.value}')"
                    class="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                重新激活
            </button>
            <button onclick="app.deleteKey('${key.value}')"
                    class="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                删除
            </button>
        `;

        card.innerHTML = `
            <!-- Card Header with Gradient Background -->
            <div class="relative bg-gradient-to-r ${isActive ? 'from-blue-50 to-indigo-50' : 'from-gray-50 to-gray-100'} p-6 border-b border-gray-100">
                <div class="flex items-center space-x-4">
                    <div class="relative">
                        <div class="w-14 h-14 bg-gradient-to-br ${isActive ? 'from-blue-500 via-purple-600 to-indigo-600' : 'from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center shadow-lg">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1 17 21 9z"></path>
                            </svg>
                        </div>
                        <!-- Status dot indicator -->
                        <div class="absolute -top-1 -right-1 w-4 h-4 ${isActive ? 'bg-green-400' : 'bg-red-400'} rounded-full border-2 border-white ${isActive ? 'animate-pulse' : ''}"></div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-mono font-bold text-gray-900 truncate mb-1">${key.value.substring(0, 20)}...</div>
                        <div class="text-xs text-gray-500 font-medium">ModelScope API Key</div>
                    </div>
                </div>

                <!-- Status Badge -->
                <div class="mt-4">
                    ${statusIndicator}
                </div>
            </div>

            <!-- Card Body -->
            <div class="p-6">
                <!-- Key Information -->
                <div class="space-y-4 mb-6">
                    ${disabledAt ? `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-gray-600">禁用时间</span>
                            <span class="text-sm text-gray-900 font-mono">${disabledAt}</span>
                        </div>
                    </div>
                    ` : ''}

                    ${key.last_failure_reason ? `
                    <div class="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div class="space-y-2">
                            <div class="text-sm font-medium text-red-600">失败原因</div>
                            <div class="text-xs text-red-700 bg-red-100 px-3 py-2 rounded font-mono break-all" title="${key.last_failure_reason}">
                                ${key.last_failure_reason}
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-blue-600">密钥状态</span>
                            <span class="text-sm font-semibold ${isActive ? 'text-green-600' : 'text-red-600'}">${isActive ? '正常运行' : '已禁用'}</span>
                        </div>
                    </div>
                    `}
                </div>
            </div>

            <!-- Card Footer with Actions -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <div class="flex items-center justify-end space-x-3">
                    ${actionButtons}
                </div>
            </div>
        `;

        return card;
    }

    async addKey() {
        // 首先，获取输入框元素和它的值
        const keyInput = document.getElementById('new-key-input');
        const button = document.getElementById('add-key-btn');
        const newKeyValue = keyInput.value.trim(); // 使用 trim() 去除前后空格

        // 添加一个健壮性检查，防止提交空值
        if (!newKeyValue) {
            alert('API密钥不能为空，请输入一个有效的密钥。'); // 提示用户
            keyInput.focus();
            return; // 提前退出函数
        }

        // Show loading state
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            添加中...
        `;

        try {
            // 关键修复：必须将字符串包装在一个带有'value'键的对象中，并序列化为JSON
            const requestBody = JSON.stringify({ value: newKeyValue });

            // 现在，发送fetch请求
            const response = await fetch('/admin/api/keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                },
                body: requestBody // 使用我们刚刚正确格式化的请求体
            });

            if (!response.ok) {
                // 如果后端返回错误，我们也应该处理它
                const errorData = await response.json().catch(() => ({ error: '添加密钥失败' }));
                throw new Error(errorData.error || '添加密钥失败');
            }

            const newKey = await response.json();
            console.log('密钥添加成功:', newKey);

            // 清空输入框以便下次输入
            keyInput.value = '';
            this.showSuccess('密钥添加成功！');
            // 在这里调用重新渲染表格的函数，将新密钥展示出来
            this.loadKeys();
        } catch (error) {
            console.error('添加密钥时出错:', error);
            alert(`添加失败: ${error.message}`); // 将错误信息展示给用户
        } finally {
            // Restore button state
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async deleteKey(keyValue) {
        // Create custom confirmation dialog
        const confirmed = await this.showConfirmDialog(
            '删除密钥',
            '确定要删除这个密钥吗？此操作无法撤销。',
            '删除',
            'danger'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/admin/api/keys', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: keyValue })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || 'Failed to delete key');
            }

            this.showSuccess('密钥删除成功！');
            this.loadKeys();
        } catch (error) {
            console.error('Error deleting key:', error);
            this.showError('删除密钥失败: ' + error.message);
        }
    }

    async reactivateKey(keyValue) {
        try {
            const response = await fetch('/admin/api/keys/reactivate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: keyValue })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || 'Failed to reactivate key');
            }

            this.showSuccess('密钥重新激活成功！');
            this.loadKeys();
        } catch (error) {
            console.error('Error reactivating key:', error);
            this.showError('重新激活密钥失败: ' + error.message);
        }
    }

    async disableKey(keyValue) {
        // 添加确认对话框
        if (!confirm('确定要禁用这个密钥吗？禁用后将无法使用此密钥进行API调用。')) {
            return;
        }

        try {
            const response = await fetch('/admin/api/keys/disable', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: keyValue })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || 'Failed to disable key');
            }

            this.showSuccess('密钥已成功禁用！');
            this.loadKeys();
        } catch (error) {
            console.error('Error disabling key:', error);
            this.showError('禁用密钥失败: ' + error.message);
        }
    }

    async showConfirmDialog(title, message, confirmText, type = 'primary') {
        return new Promise((resolve) => {
            // Create modal backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50';

            // Create modal content
            const modal = document.createElement('div');
            modal.className = 'bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden';

            const buttonClass = type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';

            modal.innerHTML = `
                <div class="p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            ${type === 'danger' ? `
                                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                            ` : `
                                <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            `}
                        </div>
                        <div class="ml-3">
                            <h3 class="text-lg font-medium text-gray-900">${title}</h3>
                            <p class="mt-2 text-sm text-gray-500">${message}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
                    <button id="cancel-btn" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200">
                        取消
                    </button>
                    <button id="confirm-btn" class="px-4 py-2 text-sm font-medium text-white ${buttonClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200">
                        ${confirmText}
                    </button>
                </div>
            `;

            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            // Add event listeners
            const cancelBtn = modal.querySelector('#cancel-btn');
            const confirmBtn = modal.querySelector('#confirm-btn');

            const cleanup = () => {
                document.body.removeChild(backdrop);
            };

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    renderTestPage() {
        const template = document.getElementById('test-template');
        const clone = template.content.cloneNode(true);
        
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        mainContent.appendChild(clone);
        
        // Setup event listeners
        this.setupTestPageEvents();
        
        // Load models
        this.loadModels();
    }

    setupTestPageEvents() {
        const startBtn = document.getElementById('start-test-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startHealthTest());
        }

        // Test source radio buttons
        const testSourceRadios = document.querySelectorAll('input[name="test-source"]');
        testSourceRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleTestSourceChange());
        });

        // Import TXT button
        const importBtn = document.getElementById('import-txt-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importKeysFromTxt());
        }

        // Add valid keys button
        const addValidKeysBtn = document.getElementById('add-valid-keys-btn');
        if (addValidKeysBtn) {
            addValidKeysBtn.addEventListener('click', () => this.addValidKeysToSystem());
        }

        // Export valid keys button
        const exportValidKeysBtn = document.getElementById('export-valid-keys-btn');
        if (exportValidKeysBtn) {
            exportValidKeysBtn.addEventListener('click', () => this.exportValidKeysToTxt());
        }

        // Remove invalid keys button
        const removeInvalidKeysBtn = document.getElementById('remove-invalid-keys-btn');
        if (removeInvalidKeysBtn) {
            removeInvalidKeysBtn.addEventListener('click', () => this.removeInvalidKeysFromSystem());
        }

        // Initialize with system source selected
        this.handleTestSourceChange();
    }

    handleTestSourceChange() {
        const selectedSource = document.querySelector('input[name="test-source"]:checked').value;
        const customKeysSection = document.getElementById('custom-keys-section');

        if (selectedSource === 'custom') {
            customKeysSection.classList.remove('hidden');
        } else {
            customKeysSection.classList.add('hidden');
        }

        // 根据测试来源显示/隐藏相应的按钮
        const addValidKeysBtn = document.getElementById('add-valid-keys-btn');
        const removeInvalidKeysBtn = document.getElementById('remove-invalid-keys-btn');
        const exportValidKeysBtn = document.getElementById('export-valid-keys-btn');

        if (selectedSource === 'custom') {
            // 自定义密钥测试：显示"添加有效密钥"按钮，隐藏"移除失效密钥"按钮
            if (addValidKeysBtn) {
                addValidKeysBtn.style.display = 'inline-flex';
            }
            if (removeInvalidKeysBtn) {
                removeInvalidKeysBtn.style.display = 'none';
            }
        } else {
            // 系统密钥测试：隐藏"添加有效密钥"按钮，显示"移除失效密钥"按钮
            if (addValidKeysBtn) {
                addValidKeysBtn.style.display = 'none';
            }
            if (removeInvalidKeysBtn) {
                removeInvalidKeysBtn.style.display = 'inline-flex';
            }
        }

        // 导出按钮始终显示
        if (exportValidKeysBtn) {
            exportValidKeysBtn.style.display = 'inline-flex';
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/admin/api/proxied-models', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });
            if (!response.ok) throw new Error('Failed to load models');

            const data = await response.json();
            this.models = data.data || [];
            this.renderModelSelect();
        } catch (error) {
            console.error('Error loading models:', error);
            this.showError('加载模型列表失败: ' + error.message);
        }
    }

    renderModelSelect() {
        const select = document.getElementById('model-select-for-test');
        if (!select) return;
        
        select.innerHTML = '<option value="">请选择模型</option>';
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            select.appendChild(option);
        });
    }

    // Import keys from TXT file
    importKeysFromTxt() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const textarea = document.getElementById('custom-keys-textarea');
                    textarea.value = content;

                    // Switch to custom mode
                    document.querySelector('input[name="test-source"][value="custom"]').checked = true;
                    this.handleTestSourceChange();
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    // Add valid keys to system
    async addValidKeysToSystem() {
        if (!this.validKeys || this.validKeys.length === 0) {
            this.showError('没有有效的密钥可以添加');
            return;
        }

        try {
            const response = await fetch('/admin/api/keys/batch-add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                },
                body: JSON.stringify({ keys: this.validKeys })
            });

            if (!response.ok) {
                throw new Error('Failed to add keys');
            }

            const result = await response.json();
            this.showSuccess(result.message);

            // Refresh keys page if we're on it
            if (window.location.hash === '#keys') {
                this.loadKeys();
            }
        } catch (error) {
            console.error('Error adding keys:', error);
            this.showError('添加密钥失败: ' + error.message);
        }
    }

    // Export valid keys to TXT file
    exportValidKeysToTxt() {
        if (!this.validKeys || this.validKeys.length === 0) {
            this.showError('没有有效的密钥可以导出');
            return;
        }

        const content = this.validKeys.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `valid_keys_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showSuccess(`已导出 ${this.validKeys.length} 个有效密钥`);
    }

    async startHealthTest() {
        const modelSelect = document.getElementById('model-select-for-test');
        const selectedModel = modelSelect.value;

        if (!selectedModel) {
            this.showError('请先选择一个模型');
            return;
        }

        // Get test source and keys
        const selectedSource = document.querySelector('input[name="test-source"]:checked').value;
        let keysToTest = [];

        if (selectedSource === 'custom') {
            const customKeysTextarea = document.getElementById('custom-keys-textarea');
            const customKeysText = customKeysTextarea.value.trim();

            if (!customKeysText) {
                this.showError('请输入要测试的自定义密钥');
                return;
            }

            keysToTest = customKeysText.split('\n')
                .map(key => key.trim())
                .filter(key => key.length > 0);

            if (keysToTest.length === 0) {
                this.showError('没有有效的密钥可以测试');
                return;
            }
        }

        // Prepare UI for testing
        this.initializeTestUI();

        // Prepare URL parameters for EventSource
        const params = new URLSearchParams({
            source: selectedSource,
            model: selectedModel
        });

        if (selectedSource === 'custom') {
            // Join keys with comma for URL parameter
            params.set('keys', keysToTest.join(','));
        }

        try {
            this.startEventSourceTest(params);
        } catch (error) {
            console.error('Error starting test:', error);
            this.showError('启动测试失败: ' + error.message);
            this.resetTestUI();
        }
    }

    initializeTestUI() {
        // Reset counters
        this.validKeys = [];
        this.invalidKeys = [];
        this.testResults = [];

        // Get current test source
        const selectedSource = document.querySelector('input[name="test-source"]:checked').value;

        // Show sections
        const statisticsSection = document.getElementById('statistics-section');
        if (statisticsSection) statisticsSection.classList.remove('hidden');

        const testResultsEmpty = document.getElementById('test-results-empty');
        if (testResultsEmpty) testResultsEmpty.classList.add('hidden');

        const testResults = document.getElementById('test-results');
        if (testResults) testResults.classList.remove('hidden');

        // Reset statistics
        const totalCount = document.getElementById('total-count');
        if (totalCount) totalCount.textContent = '0';

        const validCount = document.getElementById('valid-count');
        if (validCount) validCount.textContent = '0';

        const invalidCount = document.getElementById('invalid-count');
        if (invalidCount) invalidCount.textContent = '0';

        const successRate = document.getElementById('success-rate');
        if (successRate) successRate.textContent = '0%';

        // Reset progress
        const testProgressText = document.getElementById('test-progress-text');
        if (testProgressText) testProgressText.textContent = '正在初始化测试...';

        const testProgressPercentage = document.getElementById('test-progress-percentage');
        if (testProgressPercentage) testProgressPercentage.textContent = '0%';

        const testProgressBar = document.getElementById('test-progress-bar');
        if (testProgressBar) testProgressBar.style.width = '0%';

        // Update status indicator
        const statusIndicator = document.getElementById('test-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = `
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                <span>测试中</span>
            `;
        }

        // Clear result textareas
        const validKeysTextarea = document.getElementById('valid-keys-textarea');
        if (validKeysTextarea) validKeysTextarea.value = '';

        const invalidKeysTextarea = document.getElementById('invalid-keys-textarea');
        if (invalidKeysTextarea) invalidKeysTextarea.value = '';

        const validKeysCount = document.getElementById('valid-keys-count');
        if (validKeysCount) validKeysCount.textContent = '0 个';
        const invalidKeysCount = document.getElementById('invalid-keys-count');
        if (invalidKeysCount) invalidKeysCount.textContent = '0 个';

        // Disable start button
        const startBtn = document.getElementById('start-test-btn');
        if (startBtn) startBtn.disabled = true;

        const startTestText = document.getElementById('start-test-text');
        if (startTestText) startTestText.textContent = '测试中...';

        // Show/hide action buttons based on test source
        const addValidKeysBtn = document.getElementById('add-valid-keys-btn');
        const removeInvalidKeysBtn = document.getElementById('remove-invalid-keys-btn');
        const exportValidKeysBtn = document.getElementById('export-valid-keys-btn');

        if (selectedSource === 'custom') {
            // 自定义密钥测试：显示"添加有效密钥"按钮，隐藏"移除失效密钥"按钮
            if (addValidKeysBtn) {
                addValidKeysBtn.style.display = 'inline-flex';
                addValidKeysBtn.disabled = true;
            }
            if (removeInvalidKeysBtn) {
                removeInvalidKeysBtn.style.display = 'none';
            }
        } else {
            // 系统密钥测试：隐藏"添加有效密钥"按钮，显示"移除失效密钥"按钮
            if (addValidKeysBtn) {
                addValidKeysBtn.style.display = 'none';
            }
            if (removeInvalidKeysBtn) {
                removeInvalidKeysBtn.style.display = 'inline-flex';
                removeInvalidKeysBtn.disabled = true;
            }
        }

        // 导出按钮始终显示但禁用
        if (exportValidKeysBtn) exportValidKeysBtn.disabled = true;
    }

    resetTestUI() {
        const startBtn = document.getElementById('start-test-btn');
        if (startBtn) startBtn.disabled = false;

        const startTestText = document.getElementById('start-test-text');
        if (startTestText) startTestText.textContent = '开始测试';

        const statusIndicator = document.getElementById('test-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = `
                <div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                <span>等待开始</span>
            `;
        }

        // Close EventSource if it exists
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
    }

    startEventSourceTest(params) {
        // Add admin token to URL parameters for EventSource authentication
        params.set('token', this.adminToken);

        // Create EventSource URL with parameters
        const url = `/admin/api/keys/test?${params.toString()}`;

        // Create EventSource instance
        const eventSource = new EventSource(url);

        let testCount = 0;
        let totalKeys = 0;

        // Get total keys count for progress calculation
        if (params.get('source') === 'custom' && params.get('keys')) {
            totalKeys = params.get('keys').split(',').length;
        }

        // Handle incoming messages
        eventSource.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data);

                if (result.type === 'complete') {
                    this.completeTest(result.total);
                    eventSource.close();
                } else {
                    testCount++;
                    this.updateTestProgress(testCount, totalKeys, result);
                }
            } catch (e) {
                console.error('Error parsing SSE data:', e);
            }
        };

        // Handle errors
        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            this.showError('测试连接中断，请重试');
            this.resetTestUI();
            eventSource.close();
        };

        // Store reference for potential cleanup
        this.currentEventSource = eventSource;
    }

    updateTestProgress(testCount, totalKeys, result) {
        // Update statistics
        const totalCount = document.getElementById('total-count');
        const validCount = document.getElementById('valid-count');
        const invalidCount = document.getElementById('invalid-count');
        const successRate = document.getElementById('success-rate');

        // Store result
        this.testResults.push(result);

        if (result.status === 'success') {
            this.validKeys.push(result.key_value);
            if (validCount) validCount.textContent = this.validKeys.length;

            // Add to valid keys textarea
            const validTextarea = document.getElementById('valid-keys-textarea');
            if (validTextarea) {
                if (validTextarea.value) {
                    validTextarea.value += '\n' + result.key_value;
                } else {
                    validTextarea.value = result.key_value;
                }
            }
        } else {
            this.invalidKeys.push({key: result.key_value, error: result.error});
            if (invalidCount) invalidCount.textContent = this.invalidKeys.length;

            // Add to invalid keys textarea
            const invalidTextarea = document.getElementById('invalid-keys-textarea');
            if (invalidTextarea) {
                const errorLine = `${result.key_value} - ${result.error || 'Unknown error'}`;
                if (invalidTextarea.value) {
                    invalidTextarea.value += '\n' + errorLine;
                } else {
                    invalidTextarea.value = errorLine;
                }
            }
        }

        // Update total and success rate
        if (totalCount) totalCount.textContent = this.testResults.length;
        const rate = this.testResults.length > 0 ? Math.round((this.validKeys.length / this.testResults.length) * 100) : 0;
        if (successRate) successRate.textContent = rate + '%';

        // Update progress bar
        let percentage = 0;
        if (totalKeys > 0) {
            percentage = Math.round((testCount / totalKeys) * 100);
        }

        const testProgressText = document.getElementById('test-progress-text');
        if (testProgressText) testProgressText.textContent = `正在测试第 ${testCount} 个密钥...`;

        const testProgressPercentage = document.getElementById('test-progress-percentage');
        if (testProgressPercentage) testProgressPercentage.textContent = percentage + '%';

        const testProgressBar = document.getElementById('test-progress-bar');
        if (testProgressBar) testProgressBar.style.width = percentage + '%';

        // Update counts
        const validKeysCount = document.getElementById('valid-keys-count');
        if (validKeysCount) validKeysCount.textContent = `${this.validKeys.length} 个`;

        const invalidKeysCount = document.getElementById('invalid-keys-count');
        if (invalidKeysCount) invalidKeysCount.textContent = `${this.invalidKeys.length} 个`;
    }

    completeTest(totalTested) {
        // Update progress to 100%
        const testProgressText = document.getElementById('test-progress-text');
        if (testProgressText) testProgressText.textContent = `测试完成！共测试 ${totalTested} 个密钥`;

        const testProgressPercentage = document.getElementById('test-progress-percentage');
        if (testProgressPercentage) testProgressPercentage.textContent = '100%';

        const testProgressBar = document.getElementById('test-progress-bar');
        if (testProgressBar) testProgressBar.style.width = '100%';

        // Update status indicator
        const statusIndicator = document.getElementById('test-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>测试完成</span>
            `;
        }

        // Re-enable start button
        const startBtn = document.getElementById('start-test-btn');
        if (startBtn) startBtn.disabled = false;

        const startTestText = document.getElementById('start-test-text');
        if (startTestText) startTestText.textContent = '开始测试';

        // Get current test source
        const selectedSource = document.querySelector('input[name="test-source"]:checked').value;

        // Enable action buttons based on test results and source
        if (this.validKeys.length > 0) {
            // 启用"添加有效密钥"按钮（仅自定义密钥测试时）
            const addValidKeysBtn = document.getElementById('add-valid-keys-btn');
            if (addValidKeysBtn && selectedSource === 'custom') {
                addValidKeysBtn.disabled = false;
                addValidKeysBtn.className = addValidKeysBtn.className.replace('bg-blue-600/50 text-white/70 cursor-not-allowed', 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 cursor-pointer');
            }

            // 启用"导出有效密钥"按钮（两种测试来源都可用）
            const exportValidKeysBtn = document.getElementById('export-valid-keys-btn');
            if (exportValidKeysBtn) {
                exportValidKeysBtn.disabled = false;
                exportValidKeysBtn.className = exportValidKeysBtn.className.replace('bg-purple-600/50 text-white/70 cursor-not-allowed', 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 cursor-pointer');
            }
        }

        // 启用"移除失效密钥"按钮（仅系统密钥测试时且有失效密钥）
        if (this.invalidKeys.length > 0 && selectedSource === 'system') {
            const removeInvalidKeysBtn = document.getElementById('remove-invalid-keys-btn');
            if (removeInvalidKeysBtn) {
                removeInvalidKeysBtn.disabled = false;
                removeInvalidKeysBtn.className = removeInvalidKeysBtn.className.replace('bg-red-600/50 text-white/70 cursor-not-allowed', 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 cursor-pointer');
            }
        }

        // Show summary
        this.showSuccess(`测试完成！有效密钥: ${this.validKeys.length}，无效密钥: ${this.invalidKeys.length}`);
    }



    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    formatDateTime(dateString) {
        try {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    }

    showNotification(message, type) {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `transform transition-all duration-300 ease-in-out translate-x-full opacity-0 shadow-lg rounded-lg`;

        const icons = {
            success: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                      </svg>`,
            error: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                     <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                   </svg>`,
            info: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                  </svg>`,
            warning: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                       <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                     </svg>`
        };

        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            info: 'bg-blue-500 text-white',
            warning: 'bg-yellow-500 text-white'
        };

        notification.innerHTML = `
            <div class="flex items-center p-4 rounded-lg shadow-lg ${colors[type]} min-w-80 max-w-md">
                <div class="flex-shrink-0">
                    ${icons[type]}
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <div class="ml-4 flex-shrink-0">
                    <button class="inline-flex text-white hover:text-gray-200 focus:outline-none" onclick="this.closest('.transform').remove()">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
        }, 10);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('translate-x-full', 'opacity-0');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // 添加有效密钥到系统（仅自定义密钥测试时使用）
    async addValidKeysToSystem() {
        if (this.validKeys.length === 0) {
            this.showError('没有有效密钥可以添加');
            return;
        }

        try {
            let addedCount = 0;
            let failedCount = 0;

            for (const keyValue of this.validKeys) {
                try {
                    const response = await fetch('/admin/api/keys', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.adminToken}`
                        },
                        body: JSON.stringify({ value: keyValue })
                    });

                    if (response.ok) {
                        addedCount++;
                    } else {
                        failedCount++;
                        console.error(`Failed to add key: ${keyValue}`);
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`Error adding key ${keyValue}:`, error);
                }
            }

            if (addedCount > 0) {
                this.showSuccess(`成功添加 ${addedCount} 个有效密钥到系统${failedCount > 0 ? `，${failedCount} 个添加失败` : ''}`);
                // 刷新密钥列表
                if (this.currentPage === 'keys') {
                    this.loadKeys();
                }
            } else {
                this.showError('所有密钥添加失败');
            }
        } catch (error) {
            console.error('Error adding valid keys:', error);
            this.showError('添加密钥时发生错误: ' + error.message);
        }
    }

    // 导出有效密钥为TXT文件（两种测试来源都可用）
    exportValidKeysToTxt() {
        if (this.validKeys.length === 0) {
            this.showError('没有有效密钥可以导出');
            return;
        }

        try {
            const content = this.validKeys.join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `valid_keys_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSuccess(`成功导出 ${this.validKeys.length} 个有效密钥`);
        } catch (error) {
            console.error('Error exporting valid keys:', error);
            this.showError('导出密钥时发生错误: ' + error.message);
        }
    }

    // 移除失效密钥（仅系统密钥测试时使用）
    async removeInvalidKeysFromSystem() {
        if (this.invalidKeys.length === 0) {
            this.showError('没有失效密钥需要移除');
            return;
        }

        if (!confirm(`确定要从系统中移除 ${this.invalidKeys.length} 个失效密钥吗？此操作不可撤销。`)) {
            return;
        }

        try {
            let removedCount = 0;
            let failedCount = 0;

            for (const invalidKey of this.invalidKeys) {
                try {
                    const response = await fetch('/admin/api/keys', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.adminToken}`
                        },
                        body: JSON.stringify({ value: invalidKey.key })
                    });

                    if (response.ok) {
                        removedCount++;
                    } else {
                        failedCount++;
                        console.error(`Failed to remove key: ${invalidKey.key}`);
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`Error removing key ${invalidKey.key}:`, error);
                }
            }

            if (removedCount > 0) {
                this.showSuccess(`成功移除 ${removedCount} 个失效密钥${failedCount > 0 ? `，${failedCount} 个移除失败` : ''}`);
                // 刷新密钥列表
                if (this.currentPage === 'keys') {
                    this.loadKeys();
                }
            } else {
                this.showError('所有密钥移除失败');
            }
        } catch (error) {
            console.error('Error removing invalid keys:', error);
            this.showError('移除密钥时发生错误: ' + error.message);
        }
    }

    // ==================== Settings Page Methods ====================

    renderSettingsPage() {
        const template = document.getElementById('settings-template');
        const clone = template.content.cloneNode(true);

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        mainContent.appendChild(clone);

        // Setup event listeners
        this.setupSettingsPageEvents();

        // Load current settings
        this.loadCurrentSettings();
    }

    setupSettingsPageEvents() {
        // Password visibility toggles
        this.setupPasswordToggle('admin-token', 'toggle-admin-token', 'admin-token-eye-open', 'admin-token-eye-closed');
        this.setupPasswordToggle('api-token', 'toggle-api-token', 'api-token-eye-open', 'api-token-eye-closed');

        // Master switch for auto-reactivation
        const enabledCheckbox = document.getElementById('auto-reactivation-enabled');
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', () => {
                this.handleAutoReactivationToggle();
            });
        }

        // Mode selection radio buttons
        const modeRadios = document.querySelectorAll('input[name="reactivation-mode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleModeChange();
            });
        });

        // Cron time picker events
        this.setupCronTimePicker();

        // Save settings button
        const saveButton = document.getElementById('save-settings-btn');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveSettings();
            });
        }
    }

    setupPasswordToggle(inputId, buttonId, eyeOpenId, eyeClosedId) {
        const input = document.getElementById(inputId + '-input');
        const button = document.getElementById(buttonId);
        const eyeOpen = document.getElementById(eyeOpenId);
        const eyeClosed = document.getElementById(eyeClosedId);

        if (input && button && eyeOpen && eyeClosed) {
            button.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOpen.classList.add('hidden');
                    eyeClosed.classList.remove('hidden');
                } else {
                    input.type = 'password';
                    eyeOpen.classList.remove('hidden');
                    eyeClosed.classList.add('hidden');
                }
            });
        }
    }

    setupCronTimePicker() {
        // Hour and minute inputs
        const hourInput = document.getElementById('cron-hour');
        const minuteInput = document.getElementById('cron-minute');

        if (hourInput && minuteInput) {
            hourInput.addEventListener('change', () => this.updateCronFromTimePicker());
            minuteInput.addEventListener('change', () => this.updateCronFromTimePicker());
        }

        // Quick time buttons
        const quickButtons = document.querySelectorAll('.cron-quick-btn');
        quickButtons.forEach(button => {
            button.addEventListener('click', () => {
                const time = button.getAttribute('data-time');
                const [hour, minute] = time.split(':');

                if (hourInput) hourInput.value = hour;
                if (minuteInput) minuteInput.value = minute;

                this.updateCronFromTimePicker();

                // Visual feedback
                quickButtons.forEach(btn => btn.classList.remove('bg-blue-100', 'text-blue-700'));
                button.classList.add('bg-blue-100', 'text-blue-700');
            });
        });

        // Advanced cron toggle
        const toggleAdvanced = document.getElementById('toggle-advanced-cron');
        const advancedContainer = document.getElementById('advanced-cron-container');

        if (toggleAdvanced && advancedContainer) {
            toggleAdvanced.addEventListener('click', () => {
                if (advancedContainer.classList.contains('hidden')) {
                    advancedContainer.classList.remove('hidden');
                    toggleAdvanced.textContent = '简单设置 (时间选择器)';
                } else {
                    advancedContainer.classList.add('hidden');
                    toggleAdvanced.textContent = '高级设置 (Cron表达式)';
                }
            });
        }

        // Advanced cron input
        const cronInput = document.getElementById('cron-expression-input');
        if (cronInput) {
            cronInput.addEventListener('change', () => {
                this.updateTimePickerFromCron();
            });
        }
    }

    updateCronFromTimePicker() {
        const hourInput = document.getElementById('cron-hour');
        const minuteInput = document.getElementById('cron-minute');
        const cronInput = document.getElementById('cron-expression-input');

        if (hourInput && minuteInput && cronInput) {
            const hour = hourInput.value || '0';
            const minute = minuteInput.value || '0';
            const cronExpression = `${minute} ${hour} * * *`;
            cronInput.value = cronExpression;
        }
    }

    updateTimePickerFromCron() {
        const cronInput = document.getElementById('cron-expression-input');
        const hourInput = document.getElementById('cron-hour');
        const minuteInput = document.getElementById('cron-minute');

        if (cronInput && hourInput && minuteInput) {
            const cronValue = cronInput.value.trim();
            const parts = cronValue.split(' ');

            // Parse simple daily cron expressions (minute hour * * *)
            if (parts.length >= 2) {
                const minute = parseInt(parts[0]) || 0;
                const hour = parseInt(parts[1]) || 0;

                if (minute >= 0 && minute <= 59 && hour >= 0 && hour <= 23) {
                    minuteInput.value = minute;
                    hourInput.value = hour;
                }
            }
        }
    }

    async loadCurrentSettings() {
        try {
            const response = await fetch('/admin/api/settings', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const settings = await response.json();
            console.log('Loaded settings:', settings);

            // Populate form fields with current settings
            this.populateSettingsForm(settings);

        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('加载设置失败: ' + error.message);
        }
    }

    populateSettingsForm(settings) {
        // Authentication settings
        const adminTokenInput = document.getElementById('admin-token-input');
        const apiTokenInput = document.getElementById('api-token-input');

        if (adminTokenInput && settings.admin_token) {
            adminTokenInput.value = settings.admin_token;
        }
        if (apiTokenInput && settings.api_token) {
            apiTokenInput.value = settings.api_token;
        }

        // Auto-reactivation settings
        const autoReactivation = settings.auto_reactivation || {};

        // Master switch
        const enabledCheckbox = document.getElementById('auto-reactivation-enabled');
        if (enabledCheckbox) {
            enabledCheckbox.checked = autoReactivation.enabled || false;
        }

        // Mode selection
        const modeInterval = document.getElementById('mode-interval');
        const modeScheduled = document.getElementById('mode-scheduled');

        if (autoReactivation.mode === 'interval' && modeInterval) {
            modeInterval.checked = true;
        } else if (autoReactivation.mode === 'scheduled' && modeScheduled) {
            modeScheduled.checked = true;
        }

        // Interval and cron settings
        const intervalInput = document.getElementById('activation-interval-input');
        const cronInput = document.getElementById('cron-expression-input');
        const timezoneSelect = document.getElementById('timezone-input');

        if (intervalInput && autoReactivation.interval) {
            intervalInput.value = autoReactivation.interval;
        }
        if (cronInput && autoReactivation.cron_spec) {
            cronInput.value = autoReactivation.cron_spec;
            // Update time picker from cron expression
            this.updateTimePickerFromCron();
        }
        if (timezoneSelect && autoReactivation.timezone) {
            timezoneSelect.value = autoReactivation.timezone;
        }

        // Apply initial UI state
        this.handleAutoReactivationToggle();
        this.handleModeChange();
    }

    handleAutoReactivationToggle() {
        const enabledCheckbox = document.getElementById('auto-reactivation-enabled');
        const settingsContainer = document.getElementById('auto-reactivation-settings');

        if (enabledCheckbox && settingsContainer) {
            const isEnabled = enabledCheckbox.checked;

            // Enable/disable all child inputs
            const inputs = settingsContainer.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.disabled = !isEnabled;
            });

            // Update visual state
            if (isEnabled) {
                settingsContainer.classList.remove('opacity-50');
            } else {
                settingsContainer.classList.add('opacity-50');
            }
        }
    }

    handleModeChange() {
        const modeInterval = document.getElementById('mode-interval');
        const modeScheduled = document.getElementById('mode-scheduled');
        const intervalInput = document.getElementById('activation-interval-input');
        const cronInput = document.getElementById('cron-expression-input');
        const timezoneSelect = document.getElementById('timezone-input');

        if (modeInterval && modeInterval.checked) {
            // Interval mode: enable interval input, disable cron and timezone
            if (intervalInput) intervalInput.disabled = false;
            if (cronInput) cronInput.disabled = true;
            if (timezoneSelect) timezoneSelect.disabled = true;
        } else if (modeScheduled && modeScheduled.checked) {
            // Scheduled mode: disable interval input, enable cron and timezone
            if (intervalInput) intervalInput.disabled = true;
            if (cronInput) cronInput.disabled = false;
            if (timezoneSelect) timezoneSelect.disabled = false;
        }
    }

    async saveSettings() {
        try {
            // Collect form data
            const settingsData = this.collectSettingsFormData();

            console.log('Saving settings:', settingsData);

            // Check if admin token is being changed
            const currentAdminToken = this.adminToken;
            const newAdminToken = settingsData.admin_token;
            const isAdminTokenChanged = newAdminToken && newAdminToken !== currentAdminToken;

            // Send to backend
            const response = await fetch('/admin/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                },
                body: JSON.stringify(settingsData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Settings saved successfully:', result);

            // If admin token was changed, show notification and logout
            if (isAdminTokenChanged) {
                this.showNotification('管理员令牌已更新！请使用新令牌重新登录。', 'warning');

                // Wait a moment for user to see the notification
                setTimeout(() => {
                    this.logout();
                }, 2000);
            } else {
                this.showNotification('设置已保存成功！', 'success');
            }

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError('保存设置失败: ' + error.message);
        }
    }

    collectSettingsFormData() {
        // Authentication settings
        const adminToken = document.getElementById('admin-token-input')?.value || '';
        const apiToken = document.getElementById('api-token-input')?.value || '';

        // Auto-reactivation settings
        const enabled = document.getElementById('auto-reactivation-enabled')?.checked || false;
        const modeInterval = document.getElementById('mode-interval')?.checked;
        const mode = modeInterval ? 'interval' : 'scheduled';
        const interval = document.getElementById('activation-interval-input')?.value || '10m';
        const cronSpec = document.getElementById('cron-expression-input')?.value || '0 0 * * *';
        const timezone = document.getElementById('timezone-input')?.value || 'Asia/Shanghai';

        return {
            admin_token: adminToken,
            api_token: apiToken,
            auto_reactivation: {
                enabled: enabled,
                mode: mode,
                interval: interval,
                cron_spec: cronSpec,
                timezone: timezone
            }
        };
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AdminApp();
});
