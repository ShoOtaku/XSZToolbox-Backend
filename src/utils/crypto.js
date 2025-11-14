/**
 * 加密和哈希工具
 */

const crypto = require('crypto');

/**
 * 计算 CID 哈希（与前端插件保持一致）
 * @param {string|number} contentId - 内容 ID
 * @returns {string} SHA256 哈希（大写十六进制）
 */
function computeCIDHash(contentId) {
  const salt = process.env.HASH_SALT || 'XSZToolbox_CID_Salt_2025';
  const input = `${salt}${contentId}`;
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex').toUpperCase();
}

/**
 * 计算 HMAC-SHA256 签名
 * @param {string} data - 待签名数据
 * @param {string} secret - 密钥
 * @returns {string} HMAC 签名（十六进制）
 */
function computeHMAC(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * 验证 HMAC 签名
 * @param {string} data - 原始数据
 * @param {string} signature - 签名
 * @param {string} secret - 密钥
 * @returns {boolean} 是否有效
 */
function verifyHMAC(data, signature, secret) {
  const expectedSignature = computeHMAC(data, secret);
  // 使用 timingSafeEqual 防止时序攻击
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

/**
 * 生成随机密钥
 * @param {number} length - 字节长度
 * @returns {string} 随机密钥（十六进制）
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  computeCIDHash,
  computeHMAC,
  verifyHMAC,
  generateSecret
};
