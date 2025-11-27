/**
 * 遥控系统路由
 * 定义所有房间管理相关的API端点
 */

const express = require('express');
const router = express.Router();
const remoteController = require('../controllers/remoteController');

// 静态路由优先（避免被参数化路由匹配）
router.post('/room/create', remoteController.createRoom);
router.post('/room/join', remoteController.joinRoom);
router.post('/room/leave', remoteController.leaveRoom);
router.post('/room/publish', remoteController.publishRoom);
router.get('/room/public', remoteController.getPublicRooms);

// 参数化路由放在静态路由之后
router.get('/room/:roomCode', remoteController.getRoomInfo);
router.delete('/room/:roomCode', remoteController.closeRoom);

// 成员管理（参数化路由）
router.put('/room/:roomCode/member/:cidHash/role', remoteController.setMemberRole);
router.put('/room/:roomCode/member/:cidHash/job-role', remoteController.setMemberJobRole);
router.delete('/room/:roomCode/member/:cidHash', remoteController.kickMember);

module.exports = router;
