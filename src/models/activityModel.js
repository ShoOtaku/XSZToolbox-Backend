const dbManager = require('./database');

/**
 * 活跃度相关数据访问层
 * 封装 encounter_records / player_activity_summary / world_statistics 的操作
 */

function getDb() {
  return dbManager.getDb();
}

/**
 * 检查在给定时间窗口内是否存在重复遭遇记录
 * @param {number} contentId
 * @param {Date} encounterTime
 * @param {number} windowSeconds
 * @returns {boolean}
 */
function isDuplicate(contentId, encounterTime, windowSeconds) {
  const db = getDb();
  const windowStart = new Date(encounterTime.getTime() - windowSeconds * 1000).toISOString();
  const windowEnd = encounterTime.toISOString();

  const stmt = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM encounter_records
    WHERE content_id = ?
      AND encounter_time >= ?
      AND encounter_time <= ?
  `);

  const row = stmt.get(contentId, windowStart, windowEnd);
  return row && row.cnt > 0;
}

/**
 * 插入遭遇记录
 */
function insertEncounterRecord({
  contentId,
  characterName,
  worldId,
  territoryId,
  encounterTime,
  uploaderCid
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO encounter_records (
      content_id,
      character_name,
      world_id,
      territory_id,
      encounter_time,
      uploader_cid
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    contentId,
    characterName,
    worldId,
    territoryId,
    encounterTime.toISOString(),
    uploaderCid
  );
}

/**
 * 更新玩家活跃度汇总表
 */
function updatePlayerActivitySummary({
  contentId,
  characterName,
  worldId,
  encounterTime
}) {
  const db = getDb();
  const nowIso = encounterTime.toISOString();

  const existing = db.prepare(`
    SELECT content_id, encounter_count, first_seen
    FROM player_activity_summary
    WHERE content_id = ?
  `).get(contentId);

  if (!existing) {
    db.prepare(`
      INSERT INTO player_activity_summary (
        content_id, character_name, world_id,
        last_seen, encounter_count, unique_uploaders, first_seen, updated_at
      ) VALUES (?, ?, ?, ?, 1, 1, ?, CURRENT_TIMESTAMP)
    `).run(
      contentId,
      characterName,
      worldId,
      nowIso,
      nowIso
    );
  } else {
    db.prepare(`
      UPDATE player_activity_summary
      SET character_name = ?,
          world_id = ?,
          last_seen = ?,
          encounter_count = encounter_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE content_id = ?
    `).run(
      characterName,
      worldId,
      nowIso,
      contentId
    );

    // 更新 unique_uploaders 需要重新统计 encounter_records 中的去重上传者数
    const row = db.prepare(`
      SELECT COUNT(DISTINCT uploader_cid) AS uploader_count
      FROM encounter_records
      WHERE content_id = ?
    `).get(contentId);

    db.prepare(`
      UPDATE player_activity_summary
      SET unique_uploaders = ?
      WHERE content_id = ?
    `).run(row.uploader_count || 1, contentId);
  }
}

/**
 * 检查上传者在时间窗口内的记录数，用于限频
 */
function countUploadsByUploader(uploaderCid, windowSeconds) {
  const db = getDb();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString();

  const stmt = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM encounter_records
    WHERE uploader_cid = ?
      AND created_at >= ?
  `);

  const row = stmt.get(uploaderCid, windowStart);
  return row ? row.cnt : 0;
}

/**
 * 聚合指定时间范围内的 world_statistics
 * 用于 GET /api/activity/statistics
 */
function queryWorldStatistics({ worldId, startDate, endDate }) {
  const db = getDb();

  const params = [];
  let whereClause = '1=1';

  if (worldId) {
    whereClause += ' AND world_id = ?';
    params.push(worldId);
  }
  if (startDate) {
    whereClause += ' AND stat_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND stat_date <= ?';
    params.push(endDate);
  }

  const dailyStatsStmt = db.prepare(`
    SELECT world_id, stat_date, unique_players, total_encounters
    FROM world_statistics
    WHERE ${whereClause}
    ORDER BY stat_date DESC
  `);

  const rows = dailyStatsStmt.all(...params);
  return rows;
}

/**
 * 查询最近 N 天每个服务器的总量统计（排行榜）
 */
function queryWorldLeaderboard(days) {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      world_id,
      SUM(unique_players) AS total_unique_players,
      SUM(total_encounters) AS total_encounters
    FROM world_statistics
    WHERE stat_date >= date('now', ?)
    GROUP BY world_id
    ORDER BY total_unique_players DESC
    LIMIT 100
  `);

  const offset = `-${days} days`;
  return stmt.all(offset);
}

/**
 * 查询最近 N 天某服务器的热门地图
 */
function queryTopTerritories(worldId, days) {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      territory_id,
      COUNT(DISTINCT content_id) AS unique_players,
      COUNT(*) AS encounters
    FROM encounter_records
    WHERE world_id = ?
      AND encounter_time >= datetime('now', ?)
    GROUP BY territory_id
    ORDER BY unique_players DESC
    LIMIT 10
  `);

  const offset = `-${days} days`;
  return stmt.all(worldId, offset);
}

/**
 * 每小时统计任务：将 encounter_records 聚合进 world_statistics
 */
function aggregateWorldStatisticsForRange(startIso, endIso) {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      world_id,
      DATE(encounter_time) AS stat_date,
      COUNT(DISTINCT content_id) AS unique_players,
      COUNT(*) AS total_encounters
    FROM encounter_records
    WHERE encounter_time >= ?
      AND encounter_time < ?
    GROUP BY world_id, DATE(encounter_time)
  `).all(startIso, endIso);

  const insertStmt = db.prepare(`
    INSERT INTO world_statistics (
      world_id, stat_date, unique_players, total_encounters, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(world_id, stat_date) DO UPDATE SET
      unique_players = unique_players + excluded.unique_players,
      total_encounters = total_encounters + excluded.total_encounters,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insertMany = db.transaction((records) => {
    records.forEach((r) => {
      insertStmt.run(r.world_id, r.stat_date, r.unique_players, r.total_encounters);
    });
  });

  insertMany(rows);
}

/**
 * 查询玩家活跃度表，用于前端展示
 */
function listPlayers({ limit = 100, offset = 0, worldId, search, cid }) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (worldId) {
    clauses.push('world_id = ?');
    params.push(worldId);
  }

  if (cid) {
    clauses.push('content_id = ?');
    params.push(cid);
  }

  if (search) {
    clauses.push('character_name LIKE ?');
    params.push(`%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const stmt = db.prepare(`
    SELECT
      content_id,
      character_name,
      world_id,
      last_seen,
      encounter_count,
      unique_uploaders,
      first_seen
    FROM player_activity_summary
    ${where}
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(...params, limit, offset);
}

function countPlayers({ worldId, search, cid }) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (worldId) {
    clauses.push('world_id = ?');
    params.push(worldId);
  }

  if (cid) {
    clauses.push('content_id = ?');
    params.push(cid);
  }

  if (search) {
    clauses.push('character_name LIKE ?');
    params.push(`%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const stmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM player_activity_summary
    ${where}
  `);

  const row = stmt.get(...params);
  return row ? row.total : 0;
}

module.exports = {
  isDuplicate,
  insertEncounterRecord,
  updatePlayerActivitySummary,
  countUploadsByUploader,
  queryWorldStatistics,
  queryWorldLeaderboard,
  queryTopTerritories,
  aggregateWorldStatisticsForRange,
  listPlayers,
  countPlayers
};
