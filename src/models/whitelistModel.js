/**
 * 白名单数据模型
 */

class WhitelistModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * 检查用户是否在白名单中
   * @param {string} cidHash - CID 哈希
   * @returns {Object|null} 白名单条目
   */
  checkWhitelist(cidHash) {
    return this.db.prepare(`
      SELECT * FROM whitelist
      WHERE cid_hash = ?
        AND authorized = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get(cidHash);
  }

  /**
   * 添加用户到白名单
   * @param {Object} entry - 白名单条目
   * @returns {boolean} 是否成功
   */
  addToWhitelist(entry) {
    const { cidHash, note, addedBy, expiresAt } = entry;

    try {
      this.db.prepare(`
        INSERT INTO whitelist (cid_hash, note, added_by, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(cidHash, note, addedBy, expiresAt || null);
      return true;
    } catch (error) {
      // 如果已存在，返回 false
      if (error.code === 'SQLITE_CONSTRAINT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 从白名单移除用户
   * @param {string} cidHash - CID 哈希
   * @returns {boolean} 是否成功
   */
  removeFromWhitelist(cidHash) {
    const result = this.db.prepare(`
      DELETE FROM whitelist WHERE cid_hash = ?
    `).run(cidHash);
    return result.changes > 0;
  }

  /**
   * 更新白名单条目
   * @param {string} cidHash - CID 哈希
   * @param {Object} updates - 更新内容
   * @returns {boolean} 是否成功
   */
  updateWhitelist(cidHash, updates) {
    const { note, expiresAt, authorized } = updates;

    const result = this.db.prepare(`
      UPDATE whitelist
      SET note = COALESCE(?, note),
          expires_at = COALESCE(?, expires_at),
          authorized = COALESCE(?, authorized)
      WHERE cid_hash = ?
    `).run(note, expiresAt, authorized, cidHash);

    return result.changes > 0;
  }

  /**
   * 获取所有白名单（分页）
   * @param {number} limit - 每页数量
   * @param {number} offset - 偏移量
   * @returns {Array} 白名单列表
   */
  getAllWhitelist(limit = 100, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM whitelist
      ORDER BY added_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }

  /**
   * 获取白名单总数
   * @returns {number} 白名单总数
   */
  getWhitelistCount() {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM whitelist
      WHERE authorized = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get();
    return result.count;
  }

  /**
   * 获取白名单（GitHub 格式）
   * @returns {Object} 白名单对象
   */
  getWhitelistForGitHub() {
    const entries = this.db.prepare(`
      SELECT cid_hash, note, added_at, added_by
      FROM whitelist
      WHERE authorized = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY added_at ASC
    `).all();

    return {
      version: 1,
      last_updated: new Date().toISOString(),
      entries: entries.map(entry => ({
        cid_hash: entry.cid_hash,
        note: entry.note || '',
        added_at: entry.added_at,
        added_by: entry.added_by || 'admin'
      }))
    };
  }

  /**
   * 从 GitHub 格式导入白名单
   * @param {Object} githubData - GitHub 白名单数据
   * @returns {number} 导入数量
   */
  importFromGitHub(githubData) {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO whitelist (cid_hash, note, added_by, added_at)
      VALUES (?, ?, ?, ?)
    `);

    const importMany = this.db.transaction((entries) => {
      let count = 0;
      for (const entry of entries) {
        const result = insertStmt.run(
          entry.cid_hash,
          entry.note,
          entry.added_by || 'admin',
          entry.added_at || new Date().toISOString()
        );
        if (result.changes > 0) count++;
      }
      return count;
    });

    return importMany(githubData.entries || []);
  }
}

module.exports = WhitelistModel;
