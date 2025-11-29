/**
 * 简单的测试运行器
 * 不依赖 Jest，直接使用 Node.js 运行测试
 */

const RoomModel = require('../src/models/roomModel');
const dbManager = require('../src/models/database');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test_xsztoolbox.db');

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 简单的断言函数
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error('期望 ' + expected + '，但得到 ' + actual);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error('期望值已定义，但得到 undefined');
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error('期望值为真，但得到 ' + actual);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error('期望 null，但得到 ' + actual);
            }
        },
        toHaveLength(expected) {
            if (!actual || actual.length !== expected) {
                throw new Error('期望长度为 ' + expected + '，但得到 ' + (actual ? actual.length : 'undefined'));
            }
        },
        toHaveProperty(prop) {
            if (!actual || !actual.hasOwnProperty(prop)) {
                throw new Error('期望对象有属性 ' + prop);
            }
        }
    };
}

function test(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log('  ✅ ' + name);
    } catch (error) {
        failedTests++;
        console.log('  ❌ ' + name);
        console.log('     错误: ' + error.message);
    }
}

function describe(name, fn) {
    console.log('\n' + name);
    fn();
}

// 初始化测试环境
function setupTestEnvironment() {
    // 删除旧的测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    // 设置测试数据库路径
    process.env.DATABASE_PATH = TEST_DB_PATH;

    // 连接并初始化数据库
    dbManager.connect();
    dbManager.initTables();
}

// 清理测试环境
function cleanupTestEnvironment() {
    dbManager.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
}

// 运行测试
console.log('========================================');
console.log('  RoomModel 单元测试');
console.log('========================================');

setupTestEnvironment();

let testRoomId;
let testMemberCidHash;

// 创建测试数据
const room = RoomModel.createRoom({
    roomCode: 'TEST001',
    hostCidHash: 'HOST_HASH_123',
    roomName: '测试房间',
    maxMembers: 10,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    characterName: '测试房主',
    worldName: '测试服务器'
});
testRoomId = room.id;

testMemberCidHash = 'MEMBER_HASH_456';
RoomModel.addMember({
    roomId: testRoomId,
    cidHash: testMemberCidHash,
    characterName: '测试成员',
    worldName: '测试服务器',
    role: 'Member',
    jobRole: 'D1',
    isConnected: true
});

// 测试 createCommand()
describe('createCommand() 方法测试', () => {
    test('应该成功创建指令记录（目标为所有成员）', () => {
        const commandData = {
            roomId: testRoomId,
            targetType: 'all',
            commandType: 'move',
            commandParams: { x: 100, y: 0, z: 100 },
            sentBy: 'admin'
        };

        const result = RoomModel.createCommand(commandData);
        expect(result.lastInsertRowid).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test('应该成功创建指令记录（目标为单个成员）', () => {
        const commandData = {
            roomId: testRoomId,
            targetType: 'single',
            targetCidHash: testMemberCidHash,
            commandType: 'jump',
            commandParams: { height: 5 },
            sentBy: 'admin'
        };

        const result = RoomModel.createCommand(commandData);
        expect(result.lastInsertRowid).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test('应该支持 JSON 字符串格式的参数', () => {
        const commandData = {
            roomId: testRoomId,
            targetType: 'all',
            commandType: 'chat',
            commandParams: '{"message":"Hello World"}',
            sentBy: 'admin'
        };

        const result = RoomModel.createCommand(commandData);
        expect(result.lastInsertRowid).toBeDefined();
        expect(result.changes).toBe(1);
    });
});

// 测试 getCommandHistory()
describe('getCommandHistory() 方法测试', () => {
    // 清空之前的测试数据
    const db = dbManager.getDb();
    db.prepare('DELETE FROM remote_room_commands WHERE room_id = ?').run(testRoomId);

    // 创建 15 条测试指令
    for (let i = 1; i <= 15; i++) {
        RoomModel.createCommand({
            roomId: testRoomId,
            targetType: i % 2 === 0 ? 'all' : 'single',
            targetCidHash: i % 2 === 0 ? null : testMemberCidHash,
            commandType: 'move',
            commandParams: { x: i * 10, y: 0, z: i * 10 },
            sentBy: 'admin'
        });
    }

    test('应该默认返回最近 10 条指令', () => {
        const history = RoomModel.getCommandHistory(testRoomId);
        expect(history).toHaveLength(10);
    });

    test('应该返回指定数量的指令历史', () => {
        const history = RoomModel.getCommandHistory(testRoomId, 5);
        expect(history).toHaveLength(5);
    });

    test('应该包含目标成员名称', () => {
        const history = RoomModel.getCommandHistory(testRoomId, 5);
        history.forEach(cmd => {
            expect(cmd.target_name).toBeDefined();
        });
    });

    test('应该包含所有必需字段', () => {
        const history = RoomModel.getCommandHistory(testRoomId, 1);
        expect(history[0]).toHaveProperty('id');
        expect(history[0]).toHaveProperty('room_id');
        expect(history[0]).toHaveProperty('target_type');
        expect(history[0]).toHaveProperty('command_type');
        expect(history[0]).toHaveProperty('command_params');
        expect(history[0]).toHaveProperty('status');
        expect(history[0]).toHaveProperty('sent_by');
        expect(history[0]).toHaveProperty('sent_at');
        expect(history[0]).toHaveProperty('target_name');
    });
});

// 测试 updateCommandStatus()
describe('updateCommandStatus() 方法测试', () => {
    const result = RoomModel.createCommand({
        roomId: testRoomId,
        targetType: 'all',
        commandType: 'echo',
        commandParams: { message: 'test' },
        sentBy: 'admin',
        status: 'sent'
    });
    const testCommandId = result.lastInsertRowid;

    test('应该成功更新指令状态为失败', () => {
        const updateResult = RoomModel.updateCommandStatus(
            testCommandId,
            'failed',
            '网络连接失败'
        );
        expect(updateResult.changes).toBe(1);

        // 验证更新结果
        const history = RoomModel.getCommandHistory(testRoomId, 20);
        const updatedCmd = history.find(cmd => cmd.id === testCommandId);
        expect(updatedCmd.status).toBe('failed');
    });
});

// 测试指令历史数量限制
describe('指令历史数量限制测试', () => {
    test('当房间没有指令历史时，应返回空数组', () => {
        // 创建新房间
        const newRoom = RoomModel.createRoom({
            roomCode: 'TEST002',
            hostCidHash: 'HOST_HASH_789',
            roomName: '空房间',
            maxMembers: 10,
            expiresAt: new Date(Date.now() + 3600000).toISOString()
        });

        const history = RoomModel.getCommandHistory(newRoom.id, 10);
        expect(history).toHaveLength(0);
    });
});

cleanupTestEnvironment();

// 输出测试结果
console.log('\n========================================');
console.log('  测试完成: ' + passedTests + '/' + totalTests + ' 通过');
if (failedTests > 0) {
    console.log('  ❌ ' + failedTests + ' 个测试失败');
} else {
    console.log('  ✅ 所有测试通过！');
}
console.log('========================================\n');

process.exit(failedTests > 0 ? 1 : 0);
