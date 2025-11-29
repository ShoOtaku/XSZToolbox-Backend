/**
 * 管理员房间 API 集成测试
 * 测试职能更新、权限更新、指令发送和指令历史查询 API
 */

const assert = require('assert');
const path = require('path');
const RoomModel = require('../src/models/roomModel');
const dbManager = require('../src/models/database');

// 初始化数据库
async function initDatabase() {
  const dbPath = path.join(__dirname, '../database/xsztoolbox.db');
  await dbManager.connect(dbPath);
  console.log('✅ 数据库连接成功\n');
}

// 测试辅助函数
function createTestRoom() {
  const roomCode = 'TEST' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const hostCidHash = 'TEST_HOST_' + Date.now();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  
  return RoomModel.createRoom({
    roomCode,
    hostCidHash,
    roomName: '测试房间',
    maxMembers: 10,
    expiresAt,
    characterName: '测试房主',
    worldName: '测试服务器'
  });
}

function addTestMember(roomId, cidHash, role = 'Member', jobRole = null) {
  return RoomModel.addMember({
    roomId,
    cidHash,
    characterName: '测试成员',
    worldName: '测试服务器',
    role,
    jobRole,
    isConnected: true
  });
}

// 测试套件
async function runTests() {
  console.log('\n========== 管理员房间 API 集成测试 ==========\n');
  
  // 初始化数据库
  await initDatabase();
  
  let passedTests = 0;
  let failedTests = 0;
  
  // 测试 1: 职能更新 - 成功场景
  try {
    console.log('测试 1: 更新成员职能标识 - 成功场景');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Member', null);
    
    // 更新职能
    RoomModel.updateMemberJobRole(room.id, memberCidHash, 'MT');
    
    // 验证更新
    const member = RoomModel.getMember(room.id, memberCidHash);
    assert.strictEqual(member.job_role, 'MT', '职能应该更新为 MT');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 1 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 1 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 2: 职能更新 - 设置为 null
  try {
    console.log('测试 2: 更新成员职能标识 - 设置为 null');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Member', 'MT');
    
    // 更新职能为 null
    RoomModel.updateMemberJobRole(room.id, memberCidHash, null);
    
    const member = RoomModel.getMember(room.id, memberCidHash);
    assert.strictEqual(member.job_role, null, '职能应该更新为 null');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 2 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 2 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 3: 权限更新 - 成功场景
  try {
    console.log('测试 3: 更新成员权限角色 - 成功场景');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Member', null);
    
    // 更新权限
    RoomModel.updateMemberRole(room.id, memberCidHash, 'Leader');
    
    // 验证更新
    const member = RoomModel.getMember(room.id, memberCidHash);
    assert.strictEqual(member.role, 'Leader', '权限应该更新为 Leader');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 3 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 3 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 4: 权限更新 - Leader 降级为 Member
  try {
    console.log('测试 4: 更新成员权限角色 - Leader 降级为 Member');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Leader', null);
    
    // 降级为 Member
    RoomModel.updateMemberRole(room.id, memberCidHash, 'Member');
    
    const member = RoomModel.getMember(room.id, memberCidHash);
    assert.strictEqual(member.role, 'Member', '权限应该降级为 Member');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 4 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 4 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 5: 指令发送 - 全体成员
  try {
    console.log('测试 5: 发送房间指令 - 全体成员');
    
    const room = createTestRoom();
    
    // 创建指令
    const result = RoomModel.createCommand({
      roomId: room.id,
      targetType: 'all',
      targetCidHash: null,
      commandType: 'move',
      commandParams: { x: 100, y: 0, z: 100 },
      sentBy: 'admin',
      status: 'sent'
    });
    
    assert.ok(result.lastInsertRowid, '应该返回指令 ID');
    
    // 验证指令记录
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands.length, 1, '应该有 1 条指令记录');
    assert.strictEqual(commands[0].target_type, 'all', '目标类型应该是 all');
    assert.strictEqual(commands[0].command_type, 'move', '指令类型应该是 move');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 5 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 5 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 6: 指令发送 - 单个成员
  try {
    console.log('测试 6: 发送房间指令 - 单个成员');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Member', null);
    
    // 创建指令
    const result = RoomModel.createCommand({
      roomId: room.id,
      targetType: 'single',
      targetCidHash: memberCidHash,
      commandType: 'jump',
      commandParams: {},
      sentBy: 'admin',
      status: 'sent'
    });
    
    assert.ok(result.lastInsertRowid, '应该返回指令 ID');
    
    // 验证指令记录
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands.length, 1, '应该有 1 条指令记录');
    assert.strictEqual(commands[0].target_type, 'single', '目标类型应该是 single');
    assert.strictEqual(commands[0].target_cid_hash, memberCidHash, '目标 CID 应该匹配');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 6 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 6 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 7: 指令历史查询 - 数量限制
  try {
    console.log('测试 7: 查询指令历史 - 数量限制');
    
    const room = createTestRoom();
    
    // 创建 15 条指令
    for (let i = 0; i < 15; i++) {
      RoomModel.createCommand({
        roomId: room.id,
        targetType: 'all',
        targetCidHash: null,
        commandType: 'move',
        commandParams: { x: i, y: 0, z: 0 },
        sentBy: 'admin',
        status: 'sent'
      });
    }
    
    // 查询最近 10 条
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands.length, 10, '应该只返回 10 条记录');
    
    // 验证是按时间倒序排列
    for (let i = 0; i < commands.length - 1; i++) {
      const current = new Date(commands[i].sent_at);
      const next = new Date(commands[i + 1].sent_at);
      assert.ok(current >= next, '应该按时间倒序排列');
    }
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 7 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 7 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 8: 指令历史查询 - 包含目标成员名称
  try {
    console.log('测试 8: 查询指令历史 - 包含目标成员名称');
    
    const room = createTestRoom();
    const memberCidHash = 'TEST_MEMBER_' + Date.now();
    addTestMember(room.id, memberCidHash, 'Member', null);
    
    // 创建指令
    RoomModel.createCommand({
      roomId: room.id,
      targetType: 'single',
      targetCidHash: memberCidHash,
      commandType: 'chat',
      commandParams: { message: 'Hello' },
      sentBy: 'admin',
      status: 'sent'
    });
    
    // 查询指令历史
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands.length, 1, '应该有 1 条指令记录');
    assert.strictEqual(commands[0].target_name, '测试成员', '应该包含目标成员名称');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 8 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 8 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 9: 指令历史查询 - 全体成员显示
  try {
    console.log('测试 9: 查询指令历史 - 全体成员显示');
    
    const room = createTestRoom();
    
    // 创建全体指令
    RoomModel.createCommand({
      roomId: room.id,
      targetType: 'all',
      targetCidHash: null,
      commandType: 'echo',
      commandParams: { message: 'Test' },
      sentBy: 'admin',
      status: 'sent'
    });
    
    // 查询指令历史
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands.length, 1, '应该有 1 条指令记录');
    assert.strictEqual(commands[0].target_name, '所有成员', '全体指令应该显示"所有成员"');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 9 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 9 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 测试 10: 指令状态更新
  try {
    console.log('测试 10: 更新指令状态');
    
    const room = createTestRoom();
    
    // 创建指令
    const result = RoomModel.createCommand({
      roomId: room.id,
      targetType: 'all',
      targetCidHash: null,
      commandType: 'move',
      commandParams: { x: 100, y: 0, z: 100 },
      sentBy: 'admin',
      status: 'sent'
    });
    
    const commandId = result.lastInsertRowid;
    
    // 更新为失败状态
    RoomModel.updateCommandStatus(commandId, 'failed', '测试错误');
    
    // 验证更新
    const commands = RoomModel.getCommandHistory(room.id, 10);
    assert.strictEqual(commands[0].status, 'failed', '状态应该更新为 failed');
    assert.strictEqual(commands[0].error, '测试错误', '应该包含错误信息');
    
    // 清理
    RoomModel.deleteRoom(room.id);
    
    console.log('✅ 测试 10 通过\n');
    passedTests++;
  } catch (error) {
    console.error('❌ 测试 10 失败:', error.message, '\n');
    failedTests++;
  }
  
  // 关闭数据库连接
  dbManager.close();
  
  // 输出测试结果
  console.log('\n========== 测试结果 ==========');
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`总计: ${passedTests + failedTests}`);
  console.log('==============================\n');
  
  return failedTests === 0;
}

// 运行测试
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
