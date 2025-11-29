/**
 * RoomModel 单元测试
 * 测试房间指令相关的数据访问方法
 */

const RoomModel = require('../src/models/roomModel');
const dbManager = require('../src/models/database');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test_xsztoolbox.db');

describe('RoomModel - 指令管理功能', () => {
    let testRoomId;
    let testMemberCidHash;

    // 测试前：初始化测试数据库
    beforeAll(() => {
        // 删除旧的测试数据库
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        // 设置测试数据库路径
        process.env.DATABASE_PATH = TEST_DB_PATH;

        // 连接并初始化数据库
        dbManager.connect();
        dbManager.initTables();

        // 创建测试房间
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

        // 添加测试成员
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
    });

    // 测试后：清理测试数据库
    afterAll(() => {
        dbManager.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    describe('createCommand()', () => {
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

        test('应该支持创建失败状态的指令', () => {
            const commandData = {
                roomId: testRoomId,
                targetType: 'all',
                commandType: 'setpos',
                commandParams: { x: 0, y: 0, z: 0 },
                sentBy: 'admin',
                status: 'failed',
                error: '目标位置无效'
            };

            const result = RoomModel.createCommand(commandData);

            expect(result.lastInsertRowid).toBeDefined();
            expect(result.changes).toBe(1);
        });
    });

    describe('getCommandHistory()', () => {
        beforeAll(() => {
            // 清空之前的测试数据
            const db = dbManager.getDb();
            db.prepare('DELETE FROM remote_room_commands WHERE room_id = ?').run(testRoomId);

            // 创建多条测试指令
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
        });

        test('应该返回指定数量的指令历史', () => {
            const history = RoomModel.getCommandHistory(testRoomId, 5);

            expect(history).toHaveLength(5);
        });

        test('应该默认返回最近 10 条指令', () => {
            const history = RoomModel.getCommandHistory(testRoomId);

            expect(history).toHaveLength(10);
        });

        test('应该按时间倒序排列（最新的在前）', () => {
            const history = RoomModel.getCommandHistory(testRoomId, 5);

            // 验证时间戳是递减的
            for (let i = 0; i < history.length - 1; i++) {
                const current = new Date(history[i].sent_at);
                const next = new Date(history[i + 1].sent_at);
                expect(current >= next).toBe(true);
            }
        });

        test('应该包含目标成员名称', () => {
            const history = RoomModel.getCommandHistory(testRoomId, 5);

            history.forEach(cmd => {
                expect(cmd.target_name).toBeDefined();
                if (cmd.target_type === 'all') {
                    expect(cmd.target_name).toBe('所有成员');
                } else {
                    expect(cmd.target_name).toBeTruthy();
                }
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

    describe('updateCommandStatus()', () => {
        let testCommandId;

        beforeAll(() => {
            // 创建一条测试指令
            const result = RoomModel.createCommand({
                roomId: testRoomId,
                targetType: 'all',
                commandType: 'echo',
                commandParams: { message: 'test' },
                sentBy: 'admin',
                status: 'sent'
            });
            testCommandId = result.lastInsertRowid;
        });

        test('应该成功更新指令状态为失败', () => {
            const result = RoomModel.updateCommandStatus(
                testCommandId,
                'failed',
                '网络连接失败'
            );

            expect(result.changes).toBe(1);

            // 验证更新结果
            const history = RoomModel.getCommandHistory(testRoomId, 20);
            const updatedCmd = history.find(cmd => cmd.id === testCommandId);
            expect(updatedCmd.status).toBe('failed');
            expect(updatedCmd.error).toBe('网络连接失败');
        });

        test('应该支持更新状态为成功（清除错误信息）', () => {
            const result = RoomModel.updateCommandStatus(
                testCommandId,
                'sent',
                null
            );

            expect(result.changes).toBe(1);

            // 验证更新结果
            const history = RoomModel.getCommandHistory(testRoomId, 20);
            const updatedCmd = history.find(cmd => cmd.id === testCommandId);
            expect(updatedCmd.status).toBe('sent');
            expect(updatedCmd.error).toBeNull();
        });
    });

    describe('指令历史数量限制', () => {
        test('当请求数量超过实际记录数时，应返回所有记录', () => {
            // 清空指令表
            const db = dbManager.getDb();
            db.prepare('DELETE FROM remote_room_commands WHERE room_id = ?').run(testRoomId);

            // 只创建 3 条记录
            for (let i = 1; i <= 3; i++) {
                RoomModel.createCommand({
                    roomId: testRoomId,
                    targetType: 'all',
                    commandType: 'move',
                    commandParams: { x: i, y: 0, z: i },
                    sentBy: 'admin'
                });
            }

            // 请求 10 条，应该只返回 3 条
            const history = RoomModel.getCommandHistory(testRoomId, 10);
            expect(history).toHaveLength(3);
        });

        test('当房间没有指令历史时，应返回空数组', () => {
            // 清空指令表
            const db = dbManager.getDb();
            db.prepare('DELETE FROM remote_room_commands WHERE room_id = ?').run(testRoomId);

            const history = RoomModel.getCommandHistory(testRoomId, 10);
            expect(history).toHaveLength(0);
            expect(Array.isArray(history)).toBe(true);
        });
    });
});
