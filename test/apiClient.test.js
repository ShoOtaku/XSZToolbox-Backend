/**
 * API 客户端单元测试
 * 测试 API 方法的请求构造、错误处理和请求头设置
 */

// 模拟 fetch API
global.fetch = async (url, options) => {
    // 返回模拟的响应对象
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: {} })
    };
};

// 模拟 authManager
global.authManager = {
    getAuthHeader: () => ({ 'Authorization': 'Bearer test_token' }),
    logout: () => {}
};

// 模拟 window 对象
global.window = {
    location: {
        origin: 'http://localhost:3000',
        pathname: '/admin/index.html'
    }
};

// 加载 API 客户端代码（需要稍作修改以支持 Node.js 环境）
class APIClient {
    constructor() {
        this.baseURL = this.detectAPIUrl();
    }

    detectAPIUrl() {
        if (window.location.pathname.startsWith('/admin')) {
            return window.location.origin;
        }
        return 'http://localhost:3000';
    }

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

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // 新增的 API 方法
    async updateMemberJobRole(roomId, cidHash, jobRole) {
        return this.put(`/api/admin/room/${roomId}/member/${cidHash}/job`, {
            jobRole
        });
    }

    async updateMemberRole(roomId, cidHash, role) {
        return this.put(`/api/admin/room/${roomId}/member/${cidHash}/role`, {
            role
        });
    }

    async sendRoomCommand(roomId, commandData) {
        return this.post(`/api/admin/room/${roomId}/command`, commandData);
    }

    async getRoomCommandHistory(roomId, limit = 10) {
        return this.get(`/api/admin/room/${roomId}/commands?limit=${limit}`);
    }
}

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 简单的断言函数
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`期望 ${expected}，但得到 ${actual}`);
            }
        },
        toContain(expected) {
            if (!actual || !actual.includes(expected)) {
                throw new Error(`期望包含 ${expected}，但得到 ${actual}`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`期望值已定义，但得到 undefined`);
            }
        },
        toHaveProperty(prop) {
            if (!actual || !actual.hasOwnProperty(prop)) {
                throw new Error(`期望对象有属性 ${prop}`);
            }
        }
    };
}

function test(name, fn) {
    totalTests++;
    return fn()
        .then(() => {
            passedTests++;
            console.log(`  ✅ ${name}`);
        })
        .catch((error) => {
            failedTests++;
            console.log(`  ❌ ${name}`);
            console.log(`     错误: ${error.message}`);
        });
}

function describe(name, fn) {
    console.log(`\n${name}`);
    return fn();
}

// 运行测试
console.log('========================================');
console.log('  API 客户端单元测试');
console.log('========================================');

const api = new APIClient();

// 存储请求信息以供验证
let lastFetchUrl = '';
let lastFetchOptions = {};

// 重写 fetch 以捕获请求信息
global.fetch = async (url, options) => {
    lastFetchUrl = url;
    lastFetchOptions = options;
    
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: {} })
    };
};

async function runTests() {
    // 测试职能更新方法
    await describe('updateMemberJobRole() 方法测试', async () => {
        await test('应该构造正确的 PUT 请求 URL', async () => {
            await api.updateMemberJobRole(1, 'abc123', 'MT');
            expect(lastFetchUrl).toBe('http://localhost:3000/api/admin/room/1/member/abc123/job');
        });

        await test('应该使用 PUT 方法', async () => {
            await api.updateMemberJobRole(1, 'abc123', 'MT');
            expect(lastFetchOptions.method).toBe('PUT');
        });

        await test('应该在请求体中包含 jobRole', async () => {
            await api.updateMemberJobRole(1, 'abc123', 'MT');
            const body = JSON.parse(lastFetchOptions.body);
            expect(body).toHaveProperty('jobRole');
            expect(body.jobRole).toBe('MT');
        });

        await test('应该设置正确的请求头', async () => {
            await api.updateMemberJobRole(1, 'abc123', 'MT');
            expect(lastFetchOptions.headers['Content-Type']).toBe('application/json');
            expect(lastFetchOptions.headers['Authorization']).toBe('Bearer test_token');
        });

        await test('应该支持 null 值的 jobRole', async () => {
            await api.updateMemberJobRole(1, 'abc123', null);
            const body = JSON.parse(lastFetchOptions.body);
            expect(body.jobRole).toBe(null);
        });
    });

    // 测试权限更新方法
    await describe('updateMemberRole() 方法测试', async () => {
        await test('应该构造正确的 PUT 请求 URL', async () => {
            await api.updateMemberRole(1, 'abc123', 'Leader');
            expect(lastFetchUrl).toBe('http://localhost:3000/api/admin/room/1/member/abc123/role');
        });

        await test('应该使用 PUT 方法', async () => {
            await api.updateMemberRole(1, 'abc123', 'Leader');
            expect(lastFetchOptions.method).toBe('PUT');
        });

        await test('应该在请求体中包含 role', async () => {
            await api.updateMemberRole(1, 'abc123', 'Leader');
            const body = JSON.parse(lastFetchOptions.body);
            expect(body).toHaveProperty('role');
            expect(body.role).toBe('Leader');
        });

        await test('应该设置正确的请求头', async () => {
            await api.updateMemberRole(1, 'abc123', 'Leader');
            expect(lastFetchOptions.headers['Content-Type']).toBe('application/json');
            expect(lastFetchOptions.headers['Authorization']).toBe('Bearer test_token');
        });
    });

    // 测试指令发送方法
    await describe('sendRoomCommand() 方法测试', async () => {
        await test('应该构造正确的 POST 请求 URL', async () => {
            const commandData = {
                targetType: 'all',
                commandType: 'move',
                commandParams: { x: 100, y: 0, z: 100 }
            };
            await api.sendRoomCommand(1, commandData);
            expect(lastFetchUrl).toBe('http://localhost:3000/api/admin/room/1/command');
        });

        await test('应该使用 POST 方法', async () => {
            const commandData = {
                targetType: 'all',
                commandType: 'move',
                commandParams: { x: 100, y: 0, z: 100 }
            };
            await api.sendRoomCommand(1, commandData);
            expect(lastFetchOptions.method).toBe('POST');
        });

        await test('应该在请求体中包含完整的指令数据', async () => {
            const commandData = {
                targetType: 'single',
                targetCidHash: 'abc123',
                commandType: 'jump',
                commandParams: { height: 5 }
            };
            await api.sendRoomCommand(1, commandData);
            const body = JSON.parse(lastFetchOptions.body);
            expect(body).toHaveProperty('targetType');
            expect(body).toHaveProperty('targetCidHash');
            expect(body).toHaveProperty('commandType');
            expect(body).toHaveProperty('commandParams');
            expect(body.targetType).toBe('single');
            expect(body.commandType).toBe('jump');
        });

        await test('应该设置正确的请求头', async () => {
            const commandData = {
                targetType: 'all',
                commandType: 'move',
                commandParams: { x: 100, y: 0, z: 100 }
            };
            await api.sendRoomCommand(1, commandData);
            expect(lastFetchOptions.headers['Content-Type']).toBe('application/json');
            expect(lastFetchOptions.headers['Authorization']).toBe('Bearer test_token');
        });
    });

    // 测试指令历史查询方法
    await describe('getRoomCommandHistory() 方法测试', async () => {
        await test('应该构造正确的 GET 请求 URL（默认 limit）', async () => {
            await api.getRoomCommandHistory(1);
            expect(lastFetchUrl).toBe('http://localhost:3000/api/admin/room/1/commands?limit=10');
        });

        await test('应该构造正确的 GET 请求 URL（自定义 limit）', async () => {
            await api.getRoomCommandHistory(1, 5);
            expect(lastFetchUrl).toBe('http://localhost:3000/api/admin/room/1/commands?limit=5');
        });

        await test('应该使用 GET 方法', async () => {
            await api.getRoomCommandHistory(1);
            expect(lastFetchOptions.method).toBe('GET');
        });

        await test('应该设置正确的请求头', async () => {
            await api.getRoomCommandHistory(1);
            expect(lastFetchOptions.headers['Content-Type']).toBe('application/json');
            expect(lastFetchOptions.headers['Authorization']).toBe('Bearer test_token');
        });
    });

    // 测试错误处理
    await describe('错误处理测试', async () => {
        await test('应该处理 401 错误并调用 logout', async () => {
            let logoutCalled = false;
            global.authManager.logout = () => { logoutCalled = true; };
            
            global.fetch = async () => ({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ message: '未授权' })
            });

            try {
                await api.updateMemberJobRole(1, 'abc123', 'MT');
            } catch (error) {
                expect(logoutCalled).toBe(true);
            }
        });

        await test('应该抛出包含错误信息的异常', async () => {
            global.fetch = async () => ({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: async () => ({ message: '无效的职能标识' })
            });

            try {
                await api.updateMemberJobRole(1, 'abc123', 'INVALID');
                throw new Error('应该抛出异常');
            } catch (error) {
                expect(error.message).toContain('无效的职能标识');
            }
        });

        await test('应该在错误对象中包含状态码', async () => {
            global.fetch = async () => ({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: async () => ({ message: '房间不存在' })
            });

            try {
                await api.updateMemberJobRole(999, 'abc123', 'MT');
                throw new Error('应该抛出异常');
            } catch (error) {
                expect(error.status).toBe(404);
            }
        });
    });

    // 输出测试结果
    console.log('\n========================================');
    console.log(`  测试完成: ${passedTests}/${totalTests} 通过`);
    if (failedTests > 0) {
        console.log(`  ❌ ${failedTests} 个测试失败`);
    } else {
        console.log(`  ✅ 所有测试通过！`);
    }
    console.log('========================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
}

runTests();
