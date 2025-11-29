/**
 * 管理员数据模型
 */

const bcrypt = require('bcrypt');

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

  // ==================== 新增：用户 CRUD 方法 ====================

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.username - 用户名
   * @param {string} userData.passwordHash - 密码哈希
   * @param {string} userData.role - 角色（admin/viewer）
   * @param {string} userData.createdBy - 创建者用户名
   * @returns {number} 新用户的 ID
   * @throws {Error} 如果用户名已存在
   */
  createUser(userData) {
    const { username, passwordHash, role = 'viewer', createdBy = null } = userData;

    try {
      const result = this.db.prepare(`
        INSERT INTO admins (username, password_hash, role, created_by)
        VALUES (?, ?, ?, ?)
      `).run(username, passwordHash, role, createdBy);

      return result.lastInsertRowid;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {number} userId - 用户 ID
   * @param {Object} updates - 更新的字段
   * @param {string} [updates.username] - 新用户名
   * @param {string} [updates.role] - 新角色
   * @param {string} [updates.passwordHash] - 新密码哈希
   * @returns {boolean} 是否成功更新
   * @throws {Error} 如果用户名已存在
   */
  updateUser(userId, updates) {
    const { username, role, passwordHash } = updates;

    const fields = [];
    const values = [];

    if (username !== undefined) {
      fields.push('username = ?');
      values.push(username);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    if (passwordHash !== undefined) {
      fields.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(userId);

    try {
      const result = this.db.prepare(`
        UPDATE admins SET ${fields.join(', ')} WHERE id = ?
      `).run(...values);

      return result.changes > 0;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {number} userId - 用户 ID
   * @returns {boolean} 是否成功删除
   */
  deleteUser(userId) {
    const result = this.db.prepare(`
      DELETE FROM admins WHERE id = ?
    `).run(userId);

    return result.changes > 0;
  }

  /**
   * 通过 ID 获取用户
   * @param {number} userId - 用户 ID
   * @returns {Object|null} 用户信息
   */
  getUserById(userId) {
    return this.db.prepare(`
      SELECT * FROM admins WHERE id = ?
    `).get(userId);
  }

  /**
   * 获取用户列表（支持分页和角色筛选）
   * @param {Object} options - 查询选项
   * @param {number} [options.limit=50] - 每页数量
   * @param {number} [options.offset=0] - 偏移量
   * @param {string} [options.role] - 角色筛选
   * @returns {Object} { users: Array, total: number }
   */
  getAllUsers(options = {}) {
    const { limit = 50, offset = 0, role } = options;

    let query = 'SELECT * FROM admins';
    let countQuery = 'SELECT COUNT(*) as count FROM admins';
    const params = [];
    const countParams = [];

    if (role) {
      query += ' WHERE role = ?';
      countQuery += ' WHERE role = ?';
      params.push(role);
      countParams.push(role);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = this.db.prepare(query).all(...params);
    const totalResult = this.db.prepare(countQuery).get(...countParams);

    return {
      users,
      total: totalResult.count
    };
  }

  // ==================== 新增：登录相关方法 ====================

  /**
   * 更新登录信息
   * @param {string} username - 用户名
   */
  updateLoginInfo(username) {
    this.db.prepare(`
      UPDATE admins 
      SET last_login = CURRENT_TIMESTAMP, 
          login_count = COALESCE(login_count, 0) + 1
      WHERE username = ?
    `).run(username);
  }

  /**
   * 记录登录尝试
   * @param {string} username - 用户名
   * @param {string} ipAddress - IP 地址
   * @param {boolean} success - 是否成功
   */
  recordLoginAttempt(username, ipAddress, success) {
    // 确保 login_attempts 表存在
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 0
      )
    `).run();

    // 创建索引（如果不存在）
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)
    `).run();

    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time)
    `).run();

    // 记录登录尝试
    this.db.prepare(`
      INSERT INTO login_attempts (username, ip_address, success)
      VALUES (?, ?, ?)
    `).run(username, ipAddress, success ? 1 : 0);
  }

  /**
   * 获取失败登录次数
   * @param {string} username - 用户名
   * @param {string} ipAddress - IP 地址
   * @param {number} minutes - 时间范围（分钟）
   * @returns {number} 失败次数
   */
  getFailedAttempts(username, ipAddress, minutes = 15) {
    // 确保表存在
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 0
      )
    `).run();

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE username = ? 
        AND ip_address = ?
        AND success = 0
        AND attempt_time > datetime('now', '-${minutes} minutes')
    `).get(username, ipAddress);

    return result ? result.count : 0;
  }

  /**
   * 清除登录尝试记录
   * @param {string} username - 用户名
   * @param {string} ipAddress - IP 地址
   */
  clearLoginAttempts(username, ipAddress) {
    // 确保表存在
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 0
      )
    `).run();

    this.db.prepare(`
      DELETE FROM login_attempts
      WHERE username = ? AND ip_address = ?
    `).run(username, ipAddress);
  }

  // ==================== 新增：账号管理方法 ====================

  /**
   * 修改密码
   * @param {string} username - 用户名
   * @param {string} currentPassword - 当前密码（明文）
   * @param {string} newPassword - 新密码（明文）
   * @returns {Promise<boolean>} 是否成功
   * @throws {Error} 如果当前密码错误或新密码不符合要求
   */
  async changePassword(username, currentPassword, newPassword) {
    // 验证新密码强度
    if (newPassword.length < 8) {
      throw new Error('新密码长度至少为 8 个字符');
    }

    // 获取用户信息
    const user = this.getAdminByUsername(username);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证当前密码
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('当前密码错误');
    }

    // 哈希新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    const result = this.db.prepare(`
      UPDATE admins SET password_hash = ? WHERE username = ?
    `).run(newPasswordHash, username);

    return result.changes > 0;
  }

  /**
   * 修改用户名
   * @param {string} oldUsername - 旧用户名
   * @param {string} newUsername - 新用户名
   * @param {string} password - 密码（用于验证）
   * @returns {Promise<boolean>} 是否成功
   * @throws {Error} 如果密码错误或新用户名已存在
   */
  async changeUsername(oldUsername, newUsername, password) {
    // 获取用户信息
    const user = this.getAdminByUsername(oldUsername);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('密码错误');
    }

    // 检查新用户名是否已存在
    const existingUser = this.getAdminByUsername(newUsername);
    if (existingUser) {
      throw new Error('新用户名已存在');
    }

    // 更新用户名
    try {
      const result = this.db.prepare(`
        UPDATE admins SET username = ? WHERE username = ?
      `).run(newUsername, oldUsername);

      return result.changes > 0;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('新用户名已存在');
      }
      throw error;
    }
  }

  /**
   * 验证密码
   * @param {string} username - 用户名
   * @param {string} password - 密码（明文）
   * @returns {Promise<boolean>} 密码是否正确
   */
  async verifyPassword(username, password) {
    const user = this.getAdminByUsername(username);
    if (!user || !user.password_hash) {
      return false;
    }

    return await bcrypt.compare(password, user.password_hash);
  }
}

module.exports = AdminModel;
