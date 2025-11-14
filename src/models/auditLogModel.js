/**
 * 审计日志数据模型
 */

class AuditLogModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * 记录审计日志
   * @param {Object} logData - 日志数据
   */
  log(logData) {
    const { cidHash, action, ipAddress, userAgent, details } = logData;

    this.db.prepare(`
      INSERT INTO audit_logs (cid_hash, action, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      cidHash || null,
      action,
      ipAddress || null,
      userAgent || null,
      details ? JSON.stringify(details) : null
    );
  }

  /**
   * 获取审计日志（分页）
   * @param {number} limit - 每页数量
   * @param {number} offset - 偏移量
   * @param {string} action - 过滤操作类型（可选）
   * @returns {Array} 日志列表
   */
  getLogs(limit = 100, offset = 0, action = null) {
    if (action) {
      return this.db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).all(action, limit, offset);
    } else {
      return this.db.prepare(`
        SELECT * FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);
    }
  }

  /**
   * 获取指定用户的日志
   * @param {string} cidHash - CID 哈希
   * @param {number} limit - 限制数量
   * @returns {Array} 日志列表
   */
  getUserLogs(cidHash, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE cid_hash = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(cidHash, limit);
  }

  /**
   * 获取指定时间范围的日志统计
   * @param {number} hours - 小时数
   * @returns {Object} 统计数据
   */
  getLogStats(hours = 24) {
    const result = this.db.prepare(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      GROUP BY action
      ORDER BY count DESC
    `).all(hours);

    return result;
  }

  /**
   * 清理过期日志（保留最近 N 天）
   * @param {number} days - 保留天数
   * @returns {number} 删除数量
   */
  cleanupOldLogs(days = 90) {
    const result = this.db.prepare(`
      DELETE FROM audit_logs
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `).run(days);

    return result.changes;
  }

  /**
   * 获取日志总数
   * @returns {number} 日志总数
   */
  getLogCount() {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
    `).get();
    return result.count;
  }
}

module.exports = AuditLogModel;
