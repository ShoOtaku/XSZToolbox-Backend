/**
 * 用户控制器
 */

const crypto = require('crypto');
const UserModel = require('../models/userModel');
const WhitelistModel = require('../models/whitelistModel');
const dbManager = require('../models/database');
const logger = require('../utils/logger');

/**
 * 提交用户数据
 * POST /api/submit
 * 支持两种方式：
 * 1. 新版：同时传入 plainCid（明文）和 cid（哈希）
 * 2. 旧版：只传入 cid（哈希）
 */
async function submitUserData(req, res) {
  try {
    const { cid, plainCid, characterName, worldName, qqInfo } = req.body;

    // 验证必需字段
    if (!cid || !characterName || !worldName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: '缺少必需字段: cid, characterName, worldName'
      });
    }

    // 验证哈希格式
    if (cid.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cid format',
        message: '无效的 CID 哈希格式'
      });
    }

    // 如果提供了明文 CID，验证其哈希是否匹配
    if (plainCid) {
      const calculatedHash = crypto.createHash('sha256')
        .update(plainCid + 'XSZToolbox_CID_Salt_2025')
        .digest('hex');

      if (calculatedHash !== cid) {
        logger.warn(`⚠️ CID 哈希不匹配: plainCid=${plainCid}, hash=${cid}`);
        // 不阻止请求，只记录警告
      }
    }

    // 获取数据库实例
    const db = dbManager.getDb();
    const userModel = new UserModel(db);

    // 调试日志：记录 QQ 信息
    if (qqInfo) {
      logger.debug(`收到 QQ 信息: ${qqInfo} (${characterName})`);
    }

    // 创建或更新用户数据
    const result = userModel.upsertUser({
      cid: plainCid || null,
      cidHash: cid,
      characterName,
      worldName,
      qqInfo: qqInfo || null
    });

    logger.info(`✅ 用户数据提交成功: ${characterName}@${worldName} - ${result.status}${plainCid ? ` (CID: ${plainCid})` : ''}${qqInfo ? ` (QQ: ${qqInfo})` : ''}`);

    res.json({
      success: true,
      status: result.status,
      message: result.status === 'new_user' ? '欢迎新用户！' : '数据已更新',
      loginCount: result.loginCount
    });

  } catch (error) {
    logger.error(`❌ 用户数据提交失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 验证用户授权
 * GET /api/verify/:hash
 */
async function verifyUser(req, res) {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hash',
        message: '无效的哈希值'
      });
    }

    // 获取数据库实例
    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    // 检查白名单
    const entry = whitelistModel.checkWhitelist(hash);

    if (entry) {
      logger.info(`✅ 验证通过: ${hash}`);
      res.json({
        authorized: true,
        status: 'whitelisted',
        note: entry.note || '',
        permissions: JSON.parse(entry.permissions || '["all"]')
      });
    } else {
      logger.info(`❌ 验证失败: ${hash} - 不在白名单中`);
      res.json({
        authorized: false,
        status: 'not_whitelisted',
        note: ''
      });
    }

  } catch (error) {
    logger.error(`❌ 验证失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

/**
 * 获取白名单（GitHub 格式）
 * GET /api/whitelist
 */
async function getWhitelist(req, res) {
  try {
    const db = dbManager.getDb();
    const whitelistModel = new WhitelistModel(db);

    const whitelist = whitelistModel.getWhitelistForGitHub();

    logger.info(`✅ 白名单同步: ${whitelist.entries.length} 条记录`);

    res.json(whitelist);

  } catch (error) {
    logger.error(`❌ 白名单获取失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器错误'
    });
  }
}

module.exports = {
  submitUserData,
  verifyUser,
  getWhitelist
};
