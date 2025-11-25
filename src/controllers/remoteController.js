/**
 * 遥控系统控制器
 * 处理房间管理相关的API请求
 */

const RoomModel = require('../models/roomModel');
const WhitelistModel = require('../models/whitelistModel');
const { generateRoomCode } = require('../utils/roomCodeGenerator');

class RemoteController {
    /**
     * 创建房间
     * POST /api/remote/room/create
     */
    async createRoom(req, res) {
        try {
            const { cidHash, roomName, maxMembers = 10, expiresIn = 86400 } = req.body;

            // 参数验证
            if (!cidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: cidHash'
                });
            }

            // 验证白名单
            const whitelistEntry = WhitelistModel.getByCidHash(cidHash);
            if (!whitelistEntry || !whitelistEntry.authorized) {
                return res.status(403).json({
                    success: false,
                    error: '未授权：不在白名单中或已被禁用'
                });
            }

            // 检查是否已有活跃房间（限制每用户最多1个活跃房间）
            const existingRooms = RoomModel.getUserActiveRooms(cidHash);
            if (existingRooms.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: '已有活跃房间，请先关闭现有房间',
                    existingRoomCode: existingRooms[0].room_code
                });
            }

            // 生成唯一房间码
            let roomCode;
            let attempts = 0;
            do {
                roomCode = generateRoomCode();
                attempts++;
                if (attempts > 10) {
                    throw new Error('生成房间码失败：尝试次数过多');
                }
            } while (RoomModel.getRoomByCode(roomCode));

            // 计算过期时间
            const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

            // 创建房间
            const room = RoomModel.createRoom({
                roomCode,
                hostCidHash: cidHash,
                roomName,
                maxMembers,
                expiresAt
            });

            res.json({
                success: true,
                roomCode: room.room_code,
                roomId: room.id,
                roomName: room.room_name,
                maxMembers: room.max_members,
                expiresAt: room.expires_at,
                createdAt: room.created_at
            });

            console.log(`✅ 房间创建成功: ${roomCode} (Host: ${cidHash.substring(0, 8)}...)`);

        } catch (error) {
            console.error('创建房间失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 加入房间
     * POST /api/remote/room/join
     */
    async joinRoom(req, res) {
        try {
            const { roomCode, cidHash, characterName, worldName } = req.body;

            // 参数验证
            if (!roomCode || !cidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: roomCode 或 cidHash'
                });
            }

            // 验证房间存在
            const room = RoomModel.getRoomByCode(roomCode);
            if (!room || room.status !== 'active') {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在或已关闭'
                });
            }

            // 检查是否已过期
            if (new Date(room.expires_at) < new Date()) {
                RoomModel.closeRoom(room.id);
                return res.status(404).json({
                    success: false,
                    error: '房间已过期'
                });
            }

            // 检查是否已在房间中
            const existingMember = RoomModel.getMember(room.id, cidHash);
            if (existingMember) {
                // 更新连接状态
                RoomModel.updateMemberStatus(room.id, cidHash, true);
            } else {
                // 检查房间是否已满
                const memberCount = RoomModel.getMemberCount(room.id);
                if (memberCount >= room.max_members) {
                    return res.status(400).json({
                        success: false,
                        error: `房间已满 (${memberCount}/${room.max_members})`
                    });
                }

                // 添加成员
                RoomModel.addMember({
                    roomId: room.id,
                    cidHash,
                    characterName,
                    worldName,
                    role: 'Member'
                });
            }

            // 获取所有成员
            const members = RoomModel.getRoomMembers(room.id);
            const hostMember = members.find(m => m.role === 'Host');

            res.json({
                success: true,
                roomId: room.id,
                roomCode: room.room_code,
                roomName: room.room_name,
                hostName: hostMember?.character_name,
                hostCidHash: room.host_cid_hash,
                maxMembers: room.max_members,
                currentMembers: members.length,
                members: members.map(m => ({
                    cidHash: m.cid_hash,
                    characterName: m.character_name,
                    worldName: m.world_name,
                    role: m.role,
                    jobRole: m.job_role,
                    isConnected: m.is_connected === 1,
                    joinedAt: m.joined_at
                })),
                createdAt: room.created_at,
                expiresAt: room.expires_at
            });

            console.log(`✅ ${characterName || cidHash.substring(0, 8)}... 加入房间: ${roomCode}`);

        } catch (error) {
            console.error('加入房间失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 查询房间信息
     * GET /api/remote/room/:roomCode
     */
    async getRoomInfo(req, res) {
        try {
            const { roomCode } = req.params;

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            const members = RoomModel.getRoomMembers(room.id);
            const onlineMembers = members.filter(m => m.is_connected === 1);

            res.json({
                success: true,
                roomCode: room.room_code,
                roomName: room.room_name,
                hostCidHash: room.host_cid_hash,
                maxMembers: room.max_members,
                currentMembers: members.length,
                onlineMembers: onlineMembers.length,
                status: room.status,
                createdAt: room.created_at,
                expiresAt: room.expires_at,
                members: members.map(m => ({
                    characterName: m.character_name,
                    worldName: m.world_name,
                    role: m.role,
                    jobRole: m.job_role,
                    isConnected: m.is_connected === 1
                }))
            });

        } catch (error) {
            console.error('查询房间信息失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 离开房间
     * POST /api/remote/room/leave
     */
    async leaveRoom(req, res) {
        try {
            const { roomCode, cidHash } = req.body;

            if (!roomCode || !cidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数'
                });
            }

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            // 检查是否为房主
            if (room.host_cid_hash === cidHash) {
                return res.status(403).json({
                    success: false,
                    error: '房主不能离开房间，请使用关闭房间功能'
                });
            }

            // 移除成员
            RoomModel.removeMember(room.id, cidHash);

            res.json({
                success: true,
                message: '已离开房间'
            });

            console.log(`✅ ${cidHash.substring(0, 8)}... 离开房间: ${roomCode}`);

        } catch (error) {
            console.error('离开房间失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 关闭房间
     * DELETE /api/remote/room/:roomCode
     */
    async closeRoom(req, res) {
        try {
            const { roomCode } = req.params;
            const cidHash = req.headers['x-cid-hash'];

            if (!cidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少认证信息'
                });
            }

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            // 验证房主权限
            if (room.host_cid_hash !== cidHash) {
                return res.status(403).json({
                    success: false,
                    error: '仅房主可关闭房间'
                });
            }

            // 关闭房间
            RoomModel.closeRoom(room.id);

            res.json({
                success: true,
                message: '房间已关闭'
            });

            console.log(`✅ 房间关闭: ${roomCode}`);

        } catch (error) {
            console.error('关闭房间失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 设置成员角色权限
     * PUT /api/remote/room/:roomCode/member/:cidHash/role
     */
    async setMemberRole(req, res) {
        try {
            const { roomCode, cidHash } = req.params;
            const { role } = req.body;
            const hostCidHash = req.headers['x-cid-hash'];

            // 参数验证
            if (!role || !['Host', 'Leader', 'Member'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    error: '无效的角色类型'
                });
            }

            if (!hostCidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少认证信息'
                });
            }

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            // 验证房主权限
            if (room.host_cid_hash !== hostCidHash) {
                return res.status(403).json({
                    success: false,
                    error: '仅房主可设置成员角色'
                });
            }

            // 不能修改房主角色
            if (room.host_cid_hash === cidHash && role !== 'Host') {
                return res.status(403).json({
                    success: false,
                    error: '不能修改房主角色'
                });
            }

            // 更新角色
            RoomModel.updateMemberRole(room.id, cidHash, role);

            res.json({
                success: true,
                message: '角色已更新'
            });

            console.log(`✅ ${cidHash.substring(0, 8)}... 角色更新为: ${role}`);

        } catch (error) {
            console.error('设置成员角色失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 设置成员职业标识
     * PUT /api/remote/room/:roomCode/member/:cidHash/job-role
     */
    async setMemberJobRole(req, res) {
        try {
            const { roomCode, cidHash } = req.params;
            const { jobRole } = req.body;
            const hostCidHash = req.headers['x-cid-hash'];

            // 参数验证
            const validJobRoles = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
            if (jobRole && !validJobRoles.includes(jobRole)) {
                return res.status(400).json({
                    success: false,
                    error: '无效的职业标识'
                });
            }

            if (!hostCidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少认证信息'
                });
            }

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            // 验证房主权限
            if (room.host_cid_hash !== hostCidHash) {
                return res.status(403).json({
                    success: false,
                    error: '仅房主可设置职业标识'
                });
            }

            // 更新职业标识
            RoomModel.updateMemberJobRole(room.id, cidHash, jobRole);

            res.json({
                success: true,
                message: '职业标识已更新'
            });

            console.log(`✅ ${cidHash.substring(0, 8)}... 职业标识更新为: ${jobRole}`);

        } catch (error) {
            console.error('设置职业标识失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 踢出成员
     * DELETE /api/remote/room/:roomCode/member/:cidHash
     */
    async kickMember(req, res) {
        try {
            const { roomCode, cidHash } = req.params;
            const hostCidHash = req.headers['x-cid-hash'];

            if (!hostCidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少认证信息'
                });
            }

            const room = RoomModel.getRoomByCode(roomCode);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在'
                });
            }

            // 验证房主权限
            if (room.host_cid_hash !== hostCidHash) {
                return res.status(403).json({
                    success: false,
                    error: '仅房主可踢出成员'
                });
            }

            // 不能踢出自己
            if (cidHash === hostCidHash) {
                return res.status(403).json({
                    success: false,
                    error: '不能踢出房主'
                });
            }

            // 移除成员
            RoomModel.removeMember(room.id, cidHash);

            res.json({
                success: true,
                message: '成员已移除'
            });

            console.log(`✅ ${cidHash.substring(0, 8)}... 被踢出房间: ${roomCode}`);

        } catch (error) {
            console.error('踢出成员失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 公开房间
     * POST /api/remote/room/publish
     */
    async publishRoom(req, res) {
        try {
            const { roomCode, cidHash, duration = 30 } = req.body;

            // 参数验证
            if (!roomCode || !cidHash) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: roomCode 或 cidHash'
                });
            }

            // 验证房间存在
            const room = RoomModel.getRoomByCode(roomCode);
            if (!room || room.status !== 'active') {
                return res.status(404).json({
                    success: false,
                    error: '房间不存在或已关闭'
                });
            }

            // 验证房主权限
            if (room.host_cid_hash !== cidHash) {
                return res.status(403).json({
                    success: false,
                    error: '仅房主可公开房间'
                });
            }

            // 公开房间
            const result = RoomModel.publishRoom(roomCode, duration);

            if (result.success) {
                res.json({
                    success: true,
                    expiresAt: result.expiresAt
                });

                console.log(`✅ 房间已公开: ${roomCode} (${duration}秒)`);
            } else {
                res.status(500).json({
                    success: false,
                    error: '公开房间失败'
                });
            }

        } catch (error) {
            console.error('公开房间失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }

    /**
     * 获取公开房间列表
     * GET /api/remote/room/public
     */
    async getPublicRooms(req, res) {
        try {
            const rooms = RoomModel.getPublicRooms();

            // 格式化返回数据
            const formattedRooms = rooms.map(room => ({
                roomCode: room.room_code,
                roomName: room.room_name || '',
                hostName: room.host_name || '',
                memberCount: room.member_count,
                maxMembers: room.max_members
            }));

            res.json({
                success: true,
                rooms: formattedRooms
            });

            console.log(`✅ 获取公开房间列表: ${formattedRooms.length} 个房间`);

        } catch (error) {
            console.error('获取公开房间列表失败:', error);
            res.status(500).json({
                success: false,
                error: '服务器错误'
            });
        }
    }
}

module.exports = new RemoteController();
