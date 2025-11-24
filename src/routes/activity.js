const express = require('express');
const router = express.Router();

const { batchUpload, getStatistics, getPlayers } = require('../controllers/activityController');

// 批量上传遭遇数据
router.post('/activity/batch', batchUpload);

// 活跃度统计查询
router.get('/activity/statistics', getStatistics);

// 玩家列表查询
router.get('/activity/players', getPlayers);

module.exports = router;
