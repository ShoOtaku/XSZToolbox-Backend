/**
 * 用户数据模型
 */

class UserModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建或更新用户数据
   * @param {Object} userData - 用户数据
   * @returns {Object} 操作结果
   */
  upsertUser(userData) {
    const { cidHash, characterName, worldName, qqInfo } = userData;

    // 检查用户是否存在
    const existing = this.db.prepare(`
      SELECT id, login_count FROM users WHERE cid_hash = ?
    `).get(cidHash);

    if (existing) {
      // 更新现有用户
      this.db.prepare(`
        UPDATE users
        SET character_name = ?,
            world_name = ?,
            qq_info = COALESCE(?, qq_info),
            last_login = CURRENT_TIMESTAMP,
            login_count = login_count + 1
        WHERE cid_hash = ?
      `).run(characterName, worldName, qqInfo, cidHash);

      return {
        status: 'existing_user',
        loginCount: existing.login_count + 1
      };
    } else {
      // 插入新用户
      this.db.prepare(`
        INSERT INTO users (cid_hash, character_name, world_name, qq_info)
        VALUES (?, ?, ?, ?)
      `).run(cidHash, characterName, worldName, qqInfo);

      return {
        status: 'new_user',
        loginCount: 1
      };
    }
  }

  /**
   * 根据 CID 哈希获取用户信息
   * @param {string} cidHash - CID 哈希
   * @returns {Object|null} 用户信息
   */
  getUserByCidHash(cidHash) {
    return this.db.prepare(`
      SELECT * FROM users WHERE cid_hash = ?
    `).get(cidHash);
  }

  /**
   * 获取所有用户（分页）
   * @param {number} limit - 每页数量
   * @param {number} offset - 偏移量
   * @returns {Array} 用户列表
   */
  getAllUsers(limit = 100, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM users
      ORDER BY last_login DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }

  /**
   * 获取用户总数
   * @returns {number} 用户总数
   */
  getUserCount() {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM users
    `).get();
    return result.count;
  }

  /**
   * 获取今日活跃用户数
   * @returns {number} 今日活跃用户数
   */
  getTodayActiveCount() {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE DATE(last_login) = DATE('now')
    `).get();
    return result.count;
  }

  /**
   * 获取最近 N 天新增用户数
   * @param {number} days - 天数
   * @returns {number} 新增用户数
   */
  getNewUsersCount(days = 7) {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE first_login >= datetime('now', '-' || ? || ' days')
    `).get(days);
    return result.count;
  }

  /**
   * 获取服务器排行榜（按用户数）
   * @param {number} limit - 限制数量
   * @returns {Array} 服务器列表
   */
  getTopServers(limit = 10) {
    return this.db.prepare(`
      SELECT world_name, COUNT(*) as count
      FROM users
      WHERE world_name IS NOT NULL
      GROUP BY world_name
      ORDER BY count DESC
      LIMIT ?
    `).all(limit);
  }
}

module.exports = UserModel;
