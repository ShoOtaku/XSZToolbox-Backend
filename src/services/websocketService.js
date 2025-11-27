/**
 * WebSocket服务 (Socket.IO)
 * 处理实时房间通信和指令转发
 */

const socketIO = require('socket.io');
const SessionManager = require('./sessionManager');
const RoomModel = require('../models/roomModel');
const CommandModel = require('../models/commandModel');

class WebSocketService {
    constructor() {
        this.io = null;
        this.sessionManager = new SessionManager();
        this.cleanupInterval = null;
    }

    /**
     * 初始化Socket.IO服务器
     * @param {http.Server} server - HTTP服务器实例
     */
    init(server) {
        this.io = socketIO(server, {
            cors: {
                origin: '*', // 生产环境应配置具体域名
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: 30000,    // 30秒心跳超时
            pingInterval: 25000,   // 25秒心跳间隔
            transports: ['websocket', 'polling']
        });

        this.io.on('connection', (socket) => {
            console.log(`[WebSocket] 新连接: ${socket.id}`);
            this.handleConnection(socket);
        });

        // 启动清理任务
        this.startCleanupTask();

        console.log('✅ WebSocket服务已启动 (Socket.IO)');
    }

    /**
     * 处理客户端连接
     * @param {Socket} socket - Socket.IO客户端
     */
    handleConnection(socket) {
        // 加入房间
        socket.on('join-room', async (data) => {
            try {
                const { roomCode, cidHash } = data;

                if (!roomCode || !cidHash) {
                    console.warn(`[WebSocket] join-room 缺少必需参数 (roomCode: ${!!roomCode}, cidHash: ${!!cidHash})`);
                    return socket.emit('error', { 
                        message: '缺少必需参数：roomCode 和 cidHash 为必填项',
                        code: 'MISSING_REQUIRED_PARAMS'
                    });
                }

                // 验证房间
                const room = RoomModel.getRoomByCode(roomCode);
                if (!room) {
                    console.warn(`[WebSocket] join-room 房间不存在 (roomCode: ${roomCode}, cidHash: ${cidHash.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '房间不存在',
                        code: 'ROOM_NOT_FOUND'
                    });
                }
                
                if (room.status !== 'active') {
                    console.warn(`[WebSocket] join-room 房间已关闭 (roomCode: ${roomCode}, status: ${room.status}, cidHash: ${cidHash.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '房间已关闭',
                        code: 'ROOM_CLOSED'
                    });
                }

                // 验证成员资格
                const member = RoomModel.getMember(room.id, cidHash);
                if (!member) {
                    console.warn(`[WebSocket] join-room 非房间成员尝试加入 (roomCode: ${roomCode}, cidHash: ${cidHash.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '您不是该房间的成员',
                        code: 'NOT_ROOM_MEMBER'
                    });
                }

                // 加入Socket.IO房间
                socket.join(roomCode);

                // 注册会话
                this.sessionManager.register(cidHash, socket.id, roomCode);

                // 更新成员在线状态
                RoomModel.updateMemberStatus(room.id, cidHash, true);

                // 通知其他成员
                socket.to(roomCode).emit('member-joined', {
                    cidHash,
                    characterName: member.character_name,
                    socketId: socket.id,
                    timestamp: new Date().toISOString()
                });

                // 向当前连接者发送确认
                socket.emit('joined', {
                    roomCode,
                    message: '成功加入房间'
                });

                console.log(`[WebSocket] 成员已加入房间 (cidHash: ${cidHash.substring(0, 8)}..., roomCode: ${roomCode}, socketId: ${socket.id})`);

            } catch (error) {
                console.error('[WebSocket] join-room 未捕获错误:', {
                    error: error.message,
                    stack: error.stack,
                    socketId: socket.id,
                    data: {
                        roomCode: data?.roomCode,
                        cidHash: data?.cidHash ? data.cidHash.substring(0, 8) + '...' : undefined
                    }
                });
                socket.emit('error', { 
                    message: '加入房间失败，请稍后重试',
                    code: 'INTERNAL_ERROR'
                });
            }
        });

        // 发送指令
        socket.on('send-command', async (data) => {
            try {
                const { roomCode, targetCid, regexRole, commandType, commandData } = data;

                // 验证必需参数
                if (!roomCode || !commandType) {
                    console.warn(`[WebSocket] send-command 缺少必需参数 (roomCode: ${!!roomCode}, commandType: ${!!commandType})`);
                    return socket.emit('error', { 
                        message: '缺少必需参数：roomCode 和 commandType 为必填项',
                        code: 'MISSING_REQUIRED_PARAMS'
                    });
                }

                // 获取发送者CID
                const senderCid = this.sessionManager.getCidBySocketId(socket.id);
                if (!senderCid) {
                    console.warn(`[WebSocket] send-command 未找到会话 (socketId: ${socket.id})`);
                    return socket.emit('error', { 
                        message: '会话已过期，请重新加入房间',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                // 验证房间
                const room = RoomModel.getRoomByCode(roomCode);
                if (!room) {
                    console.warn(`[WebSocket] send-command 房间不存在 (roomCode: ${roomCode}, 发送者: ${senderCid.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '房间不存在',
                        code: 'ROOM_NOT_FOUND'
                    });
                }
                
                if (room.status !== 'active') {
                    console.warn(`[WebSocket] send-command 房间已关闭 (roomCode: ${roomCode}, status: ${room.status}, 发送者: ${senderCid.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '房间已关闭，无法发送指令',
                        code: 'ROOM_CLOSED'
                    });
                }

                // 验证发送者权限
                const sender = RoomModel.getMember(room.id, senderCid);
                if (!sender) {
                    console.warn(`[WebSocket] send-command 发送者不是房间成员 (roomCode: ${roomCode}, 发送者: ${senderCid.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '您不是该房间的成员',
                        code: 'NOT_ROOM_MEMBER'
                    });
                }
                
                if (!['Host', 'Leader'].includes(sender.role)) {
                    console.warn(`[WebSocket] send-command 权限不足 (roomCode: ${roomCode}, 发送者: ${senderCid.substring(0, 8)}..., role: ${sender.role})`);
                    return socket.emit('error', { 
                        message: '权限不足：仅房主和指挥可发送指令',
                        code: 'INSUFFICIENT_PERMISSION'
                    });
                }

                // 验证和清理 commandData
                let sanitizedData = commandData ?? {};
                
                // 检查是否为 null/undefined/missing，记录日志
                if (commandData === null || commandData === undefined) {
                    console.warn(`[WebSocket] commandData 为 ${commandData === null ? 'null' : 'undefined'}，已默认为空对象 (发送者: ${senderCid.substring(0, 8)}..., 房间: ${roomCode}, 指令类型: ${commandType})`);
                }
                
                // 类型检查：确保是对象类型
                if (typeof sanitizedData !== 'object' || Array.isArray(sanitizedData)) {
                    console.warn(`[WebSocket] commandData 类型无效: ${typeof sanitizedData}, isArray: ${Array.isArray(sanitizedData)} (发送者: ${senderCid.substring(0, 8)}..., 房间: ${roomCode}, 指令类型: ${commandType})`);
                    return socket.emit('error', { 
                        message: '指令数据格式错误：commandData 必须是对象类型',
                        code: 'INVALID_COMMAND_DATA_TYPE'
                    });
                }

                // 确定目标成员列表
                let targets = [];
                if (targetCid) {
                    // 单播模式
                    const targetMember = RoomModel.getMember(room.id, targetCid);
                    if (!targetMember) {
                        console.warn(`[WebSocket] send-command 目标成员不存在 (targetCid: ${targetCid.substring(0, 8)}..., 房间: ${roomCode})`);
                        return socket.emit('error', { 
                            message: '目标成员不存在',
                            code: 'TARGET_NOT_FOUND'
                        });
                    }
                    if (!targetMember.is_connected) {
                        console.warn(`[WebSocket] send-command 目标成员离线 (targetCid: ${targetCid.substring(0, 8)}..., 房间: ${roomCode})`);
                        return socket.emit('error', { 
                            message: '目标成员当前离线',
                            code: 'TARGET_OFFLINE'
                        });
                    }
                    targets = [targetMember];
                } else if (regexRole) {
                    // RegexRole选择器模式
                    targets = RoomModel.selectMembersByRole(room.id, regexRole);
                    if (targets.length === 0) {
                        console.warn(`[WebSocket] send-command 未找到匹配角色的成员 (regexRole: ${regexRole}, 房间: ${roomCode})`);
                        return socket.emit('error', { 
                            message: `未找到匹配角色 "${regexRole}" 的在线成员`,
                            code: 'NO_MATCHING_ROLE'
                        });
                    }
                } else {
                    // 广播模式（所有在线成员）
                    targets = RoomModel.getRoomMembers(room.id).filter(m => m.is_connected === 1);
                    if (targets.length === 0) {
                        console.warn(`[WebSocket] send-command 房间内无在线成员 (房间: ${roomCode})`);
                        return socket.emit('error', { 
                            message: '房间内当前无在线成员',
                            code: 'NO_ONLINE_MEMBERS'
                        });
                    }
                }

                // 记录指令
                let command;
                try {
                    command = CommandModel.createCommand({
                        roomId: room.id,
                        senderCidHash: senderCid,
                        targetCidHash: targetCid || null,
                        commandType,
                        commandData: JSON.stringify(sanitizedData),
                        status: 'pending'
                    });
                    console.log(`[WebSocket] 指令已创建 (ID: ${command.id}, 类型: ${commandType}, 发送者: ${senderCid.substring(0, 8)}..., 房间: ${roomCode})`);
                } catch (dbError) {
                    console.error(`[WebSocket] send-command 数据库错误:`, {
                        error: dbError.message,
                        stack: dbError.stack,
                        roomCode,
                        senderCid: senderCid.substring(0, 8) + '...',
                        commandType
                    });
                    return socket.emit('error', { 
                        message: '保存指令失败，请稍后重试',
                        code: 'DATABASE_ERROR'
                    });
                }

                // 转发指令给目标成员
                const targetSocketIds = targets.map(t => this.sessionManager.getSocketIdByCid(t.cid_hash)).filter(Boolean);

                if (targetSocketIds.length === 0) {
                    console.warn(`[WebSocket] send-command 目标成员无活动连接 (房间: ${roomCode}, 目标数: ${targets.length})`);
                    return socket.emit('error', { 
                        message: '目标成员无活动连接，请确认成员在线状态',
                        code: 'NO_ACTIVE_CONNECTIONS'
                    });
                }

                for (const targetSocketId of targetSocketIds) {
                    this.io.to(targetSocketId).emit('command', {
                        commandId: command.id,
                        senderCid,
                        commandType,
                        data: sanitizedData,
                        timestamp: new Date().toISOString()
                    });
                }

                // 向发送者确认
                socket.emit('command-sent', {
                    commandId: command.id,
                    targetCount: targetSocketIds.length,
                    timestamp: new Date().toISOString()
                });

                console.log(`[WebSocket] 指令已转发 (ID: ${command.id}, 类型: ${commandType}, 目标数: ${targetSocketIds.length}, 房间: ${roomCode})`);

            } catch (error) {
                console.error('[WebSocket] send-command 未捕获错误:', {
                    error: error.message,
                    stack: error.stack,
                    socketId: socket.id,
                    data: {
                        roomCode: data?.roomCode,
                        commandType: data?.commandType,
                        hasCommandData: data?.commandData !== undefined
                    }
                });
                socket.emit('error', { 
                    message: '发送指令失败，请稍后重试',
                    code: 'INTERNAL_ERROR'
                });
            }
        });

        // 指令确认
        socket.on('command-ack', async (data) => {
            try {
                const { commandId, status, errorMessage } = data;

                if (!commandId || !status) {
                    return;
                }

                // 更新指令状态
                CommandModel.updateCommandStatus({
                    commandId,
                    status,
                    errorMessage: errorMessage || null,
                    executedAt: new Date()
                });

                const cidHash = this.sessionManager.getCidBySocketId(socket.id);
                console.log(`[WebSocket] 指令 ${commandId} 确认: ${status} (CID: ${cidHash?.substring(0, 8)}...)`);

                // 可选：通知房主指令执行结果
                const command = CommandModel.getCommandById(commandId);
                if (command) {
                    const room = RoomModel.getRoomById(command.room_id);
                    if (room) {
                        const hostSocketId = this.sessionManager.getSocketIdByCid(room.host_cid_hash);
                        if (hostSocketId) {
                            this.io.to(hostSocketId).emit('command-ack', {
                                commandId,
                                status,
                                errorMessage,
                                executorCid: cidHash,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }

            } catch (error) {
                console.error('[WebSocket] command-ack 错误:', error);
            }
        });

        // 心跳
        socket.on('heartbeat', async (data) => {
            try {
                const { roomCode, cidHash } = data;

                if (!roomCode || !cidHash) {
                    return;
                }

                const room = RoomModel.getRoomByCode(roomCode);
                if (room) {
                    RoomModel.updateMemberLastActive(room.id, cidHash);
                }

            } catch (error) {
                console.error('[WebSocket] heartbeat 错误:', error);
            }
        });

        // 更新成员职业标识（由客户端发送）
        socket.on('update-job-role', async (data) => {
            try {
                const { roomCode, jobRole } = data;
                
                if (!roomCode || !jobRole) {
                    console.warn(`[WebSocket] update-job-role 缺少必需参数 (roomCode: ${!!roomCode}, jobRole: ${!!jobRole})`);
                    return socket.emit('error', { 
                        message: '缺少必需参数：roomCode 和 jobRole 为必填项',
                        code: 'MISSING_REQUIRED_PARAMS'
                    });
                }
                
                const cidHash = this.sessionManager.getCidBySocketId(socket.id);
                if (!cidHash) {
                    console.warn(`[WebSocket] update-job-role 未找到会话 (socketId: ${socket.id})`);
                    return socket.emit('error', { 
                        message: '会话已过期，请重新加入房间',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                const room = RoomModel.getRoomByCode(roomCode);
                if (!room) {
                    console.warn(`[WebSocket] update-job-role 房间不存在 (roomCode: ${roomCode}, cidHash: ${cidHash.substring(0, 8)}...)`);
                    return socket.emit('error', { 
                        message: '房间不存在',
                        code: 'ROOM_NOT_FOUND'
                    });
                }

                // 更新职业标识
                RoomModel.updateMemberJobRole(room.id, cidHash, jobRole);

                // 广播更新
                this.io.to(roomCode).emit('member-updated', {
                    cidHash,
                    jobRole,
                    timestamp: new Date().toISOString()
                });

                console.log(`[WebSocket] 职业标识已更新 (cidHash: ${cidHash.substring(0, 8)}..., jobRole: ${jobRole}, roomCode: ${roomCode})`);

            } catch (error) {
                console.error('[WebSocket] update-job-role 未捕获错误:', {
                    error: error.message,
                    stack: error.stack,
                    socketId: socket.id,
                    data: {
                        roomCode: data?.roomCode,
                        jobRole: data?.jobRole
                    }
                });
                socket.emit('error', { 
                    message: '更新职业标识失败，请稍后重试',
                    code: 'INTERNAL_ERROR'
                });
            }
        });

        // 断开连接
        socket.on('disconnect', async () => {
            try {
                const cidHash = this.sessionManager.getCidBySocketId(socket.id);
                if (!cidHash) {
                    return;
                }

                const roomCode = this.sessionManager.getRoomCodeByCid(cidHash);

                // 更新离线状态
                if (roomCode) {
                    const room = RoomModel.getRoomByCode(roomCode);
                    if (room) {
                        RoomModel.updateMemberStatus(room.id, cidHash, false);

                        // 通知其他成员
                        this.io.to(roomCode).emit('member-left', {
                            cidHash,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // 注销会话
                this.sessionManager.unregister(cidHash);

                console.log(`[WebSocket] 断开连接: ${socket.id} (CID: ${cidHash.substring(0, 8)}...)`);

            } catch (error) {
                console.error('[WebSocket] disconnect 错误:', error);
            }
        });
    }

    /**
     * 启动清理任务
     * 定期清理过期房间和离线超时成员
     */
    startCleanupTask() {
        this.cleanupInterval = setInterval(async () => {
            try {
                // 清理过期房间
                const expiredRooms = RoomModel.getExpiredRooms();
                for (const room of expiredRooms) {
                    // 通知房间成员
                    this.io.to(room.room_code).emit('room-closed', {
                        reason: '房间已过期',
                        timestamp: new Date().toISOString()
                    });

                    // 关闭房间
                    RoomModel.closeRoom(room.id);
                    console.log(`[Cleanup] 房间 ${room.room_code} 已过期并关闭`);
                }

                // 清理旧的指令记录（保留30天）
                CommandModel.cleanOldCommands(30);

            } catch (error) {
                console.error('[Cleanup] 清理任务错误:', error);
            }
        }, 60000); // 每分钟执行一次

        console.log('✅ 清理任务已启动');
    }

    /**
     * 停止清理任务
     */
    stopCleanupTask() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('清理任务已停止');
        }
    }

    /**
     * 获取Socket.IO实例
     * @returns {Server} Socket.IO服务器实例
     */
    getIO() {
        return this.io;
    }

    /**
     * 获取会话管理器
     * @returns {SessionManager} 会话管理器实例
     */
    getSessionManager() {
        return this.sessionManager;
    }

    /**
     * 关闭服务
     */
    close() {
        this.stopCleanupTask();
        if (this.io) {
            this.io.close();
            console.log('WebSocket服务已关闭');
        }
    }
}

module.exports = new WebSocketService();
