/**
 * 房间码生成器
 * 生成6位房间码，排除易混淆字符（0OIL1）
 */

const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 排除 0, O, I, L, 1

/**
 * 生成随机房间码
 * @returns {string} 6位大写房间码
 */
function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * VALID_CHARS.length);
        code += VALID_CHARS[randomIndex];
    }
    return code;
}

/**
 * 验证房间码格式
 * @param {string} code - 待验证的房间码
 * @returns {boolean} 是否有效
 */
function validateRoomCode(code) {
    if (typeof code !== 'string' || code.length !== 6) {
        return false;
    }

    // 检查每个字符是否在有效字符集中
    for (let char of code) {
        if (!VALID_CHARS.includes(char)) {
            return false;
        }
    }

    return true;
}

module.exports = {
    generateRoomCode,
    validateRoomCode,
    VALID_CHARS
};
