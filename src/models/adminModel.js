/**
 * 管理员数据模型
 */

class AdminModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * 检查是否为管理员
   * @param {string} cidHash - CID 哈希
   * @returns {boolean} 是否为管理员
   */
  isAdmin(cidHash) {
    const result = this.db.prepare(`
      SELECT id FROM admins WHERE cid_hash = ?
    `).get(cidHash);

    return !!result;
  }

  /**
   * 获取管理员信息
   * @param {string} cidHash - CID 哈希
   * @returns {Object|null} 管理员信息
   */
  getAdmin(cidHash) {
    return this.db.prepare(`
      SELECT * FROM admins WHERE cid_hash = ?
    `).get(cidHash);
  }

  /**
   * 添加管理员
   * @param {string} cidHash - CID 哈希
   * @param {string} role - 角色（admin/super_admin）
   * @returns {boolean} 是否成功
   */
  addAdmin(cidHash, role = 'admin') {
    try {
      this.db.prepare(`
        INSERT INTO admins (cid_hash, role)
        VALUES (?, ?)
      `).run(cidHash, role);
      return true;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 移除管理员
   * @param {string} cidHash - CID 哈希
   * @returns {boolean} 是否成功
   */
  removeAdmin(cidHash) {
    const result = this.db.prepare(`
      DELETE FROM admins WHERE cid_hash = ?
    `).run(cidHash);

    return result.changes > 0;
  }

  /**
   * 获取所有管理员
   * @returns {Array} 管理员列表
   */
  getAllAdmins() {
    return this.db.prepare(`
      SELECT * FROM admins ORDER BY created_at ASC
    `).all();
  }

  /**
   * 获取管理员总数
   * @returns {number} 管理员总数
   */
  getAdminCount() {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM admins
    `).get();
    return result.count;
  }
}

module.exports = AdminModel;
