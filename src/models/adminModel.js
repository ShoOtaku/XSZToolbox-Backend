/**
 * 管理员数据模型
 */

class AdminModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * 检查是否为管理员（通过 CID 哈希，兼容旧版）
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
   * 通过用户名获取管理员信息
   * @param {string} username - 用户名
   * @returns {Object|null} 管理员信息
   */
  getAdminByUsername(username) {
    return this.db.prepare(`
      SELECT * FROM admins WHERE username = ?
    `).get(username);
  }

  /**
   * 获取管理员信息（通过 CID 哈希，兼容旧版）
   * @param {string} cidHash - CID 哈希
   * @returns {Object|null} 管理员信息
   */
  getAdmin(cidHash) {
    return this.db.prepare(`
      SELECT * FROM admins WHERE cid_hash = ?
    `).get(cidHash);
  }

  /**
   * 添加管理员（新版本使用用户名/密码）
   * @param {Object} adminData - 管理员数据
   * @param {string} adminData.username - 用户名
   * @param {string} adminData.passwordHash - 密码哈希
   * @param {string} adminData.role - 角色（admin/super_admin）
   * @param {string} adminData.cidHash - CID 哈希（可选，兼容旧版）
   * @returns {boolean} 是否成功
   */
  addAdmin(adminData) {
    const { username, passwordHash, role = 'admin', cidHash = null } = adminData;

    try {
      this.db.prepare(`
        INSERT INTO admins (username, password_hash, cid_hash, role)
        VALUES (?, ?, ?, ?)
      `).run(username, passwordHash, cidHash, role);
      return true;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 移除管理员（通过用户名）
   * @param {string} username - 用户名
   * @returns {boolean} 是否成功
   */
  removeAdmin(username) {
    const result = this.db.prepare(`
      DELETE FROM admins WHERE username = ?
    `).run(username);

    return result.changes > 0;
  }

  /**
   * 移除管理员（通过 CID 哈希，兼容旧版）
   * @param {string} cidHash - CID 哈希
   * @returns {boolean} 是否成功
   */
  removeAdminByCidHash(cidHash) {
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
