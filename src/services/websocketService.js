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
                    return socket.emit('error', { message: '缺少必需参数' });
                }

                // 验证房间
                const room = RoomModel.getRoomByCode(roomCode);
                if (!room || room.status !== 'active') {
                    return socket.emit('error', { message: '房间不存在或已关闭' });
                }

                // 验证成员资格
                const member = RoomModel.getMember(room.id, cidHash);
                if (!member) {
                    return socket.emit('error', { message: '未加入该房间' });
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

                console.log(`[WebSocket] ${cidHash.substring(0, 8)}... 加入房间 ${roomCode}`);

            } catch (error) {
                console.error('[WebSocket] join-room 错误:', error);
                socket.emit('error', { message: '加入房间失败' });
            }
        });

        // 发送指令
        socket.on('send-command', async (data) => {
            try {
                const { roomCode, targetCid, regexRole, commandType, commandData } = data;

                // 获取发送者CID
                const senderCid = this.sessionManager.getCidBySocketId(socket.id);
                if (!senderCid) {
                    return socket.emit('error', { message: '未找到会话' });
                }

                // 验证房间
                const room = RoomModel.getRoomByCode(roomCode);
                if (!room || room.status !== 'active') {
                    return socket.emit('error', { message: '房间不存在或已关闭' });
                }

                // 验证发送者权限
                const sender = RoomModel.getMember(room.id, senderCid);
                if (!sender || !['Host', 'Leader'].includes(sender.role)) {
                    return socket.emit('error', { message: '权限不足：仅房主和指挥可发送指令' });
                }

                // 确定目标成员列表
                let targets = [];
                if (targetCid) {
                    // 单播模式
                    const targetMember = RoomModel.getMember(room.id, targetCid);
                    if (targetMember && targetMember.is_connected) {
                        targets = [targetMember];
                    }
                } else if (regexRole) {
                    // RegexRole选择器模式
                    targets = RoomModel.selectMembersByRole(room.id, regexRole);
                } else {
                    // 广播模式（所有在线成员）
                    targets = RoomModel.getRoomMembers(room.id).filter(m => m.is_connected === 1);
                }

                if (targets.length === 0) {
                    return socket.emit('error', { message: '未找到目标成员' });
                }

                // 记录指令
                const command = CommandModel.createCommand({
                    roomId: room.id,
                    senderCidHash: senderCid,
                    targetCidHash: targetCid || null,
                    commandType,
                    commandData: JSON.stringify(commandData),
                    status: 'pending'
                });

                // 转发指令给目标成员
                const targetSocketIds = targets.map(t => this.sessionManager.getSocketIdByCid(t.cid_hash)).filter(Boolean);

                for (const targetSocketId of targetSocketIds) {
                    this.io.to(targetSocketId).emit('command', {
                        commandId: command.id,
                        senderCid,
                        commandType,
                        data: commandData,
                        timestamp: new Date().toISOString()
                    });
                }

                // 向发送者确认
                socket.emit('command-sent', {
                    commandId: command.id,
                    targetCount: targetSocketIds.length,
                    timestamp: new Date().toISOString()
                });

                console.log(`[WebSocket] 指令 ${command.id} 已发送: ${commandType} → ${targetSocketIds.length} 个目标`);

            } catch (error) {
                console.error('[WebSocket] send-command 错误:', error);
                socket.emit('error', { message: '发送指令失败' });
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
                const cidHash = this.sessionManager.getCidBySocketId(socket.id);

                if (!cidHash) {
                    return socket.emit('error', { message: '未找到会话' });
                }

                const room = RoomModel.getRoomByCode(roomCode);
                if (!room) {
                    return socket.emit('error', { message: '房间不存在' });
                }

                // 更新职业标识
                RoomModel.updateMemberJobRole(room.id, cidHash, jobRole);

                // 广播更新
                this.io.to(roomCode).emit('member-updated', {
                    cidHash,
                    jobRole,
                    timestamp: new Date().toISOString()
                });

                console.log(`[WebSocket] ${cidHash.substring(0, 8)}... 职业标识更新: ${jobRole}`);

            } catch (error) {
                console.error('[WebSocket] update-job-role 错误:', error);
                socket.emit('error', { message: '更新职业标识失败' });
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
