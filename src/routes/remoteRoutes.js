/**
 * 遥控系统路由
 * 定义所有房间管理相关的API端点
 */

const express = require('express');
const router = express.Router();
const remoteController = require('../controllers/remoteController');

// 房间管理
router.post('/room/create', remoteController.createRoom);
router.post('/room/join', remoteController.joinRoom);
router.get('/room/:roomCode', remoteController.getRoomInfo);
router.post('/room/leave', remoteController.leaveRoom);
router.delete('/room/:roomCode', remoteController.closeRoom);

// 公开房间
router.post('/room/publish', remoteController.publishRoom);
router.get('/room/public', remoteController.getPublicRooms);

// 成员管理
router.put('/room/:roomCode/member/:cidHash/role', remoteController.setMemberRole);
router.put('/room/:roomCode/member/:cidHash/job-role', remoteController.setMemberJobRole);
router.delete('/room/:roomCode/member/:cidHash', remoteController.kickMember);

module.exports = router;
