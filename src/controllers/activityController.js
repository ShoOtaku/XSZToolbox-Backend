const {
  isDuplicate,
  insertEncounterRecord,
  updatePlayerActivitySummary,
  countUploadsByUploader,
  queryWorldStatistics,
  queryWorldLeaderboard,
  queryTopTerritories,
  listPlayers,
  countPlayers
} = require('../models/activityModel');

/**
 * 简单数据校验
 */
function validateEncounter(enc) {
  if (!enc) return false;
  if (typeof enc.contentId !== 'number') return false;
  if (typeof enc.nameAtWorld !== 'string' || !enc.nameAtWorld.includes('@')) return false;
  if (typeof enc.worldId !== 'number') return false;
  if (typeof enc.territoryId !== 'number') return false;
  if (typeof enc.encounterTime !== 'string') return false;
  const t = Date.parse(enc.encounterTime);
  if (Number.isNaN(t)) return false;
  return true;
}

function parseEncounterTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalid encounterTime');
  }
  return date;
}

/**
 * POST /api/activity/batch
 */
async function batchUpload(req, res, next) {
  try {
    const { uploaderCid, encounters, uploadTime } = req.body || {};

    if (typeof uploaderCid !== 'number' || !Number.isFinite(uploaderCid)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_data',
        message: 'uploaderCid 必须为数字'
      });
    }

    if (!Array.isArray(encounters) || encounters.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_data',
        message: 'encounters 字段不能为空数组'
      });
    }

    // 简单防刷：1 小时内最多 1000 条
    const uploadsLastHour = countUploadsByUploader(uploaderCid, 3600);
    if (uploadsLastHour >= 1000) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit_exceeded',
        message: '上传过于频繁，请稍后再试'
      });
    }

    let received = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const enc of encounters) {
      if (!validateEncounter(enc)) {
        invalid += 1;
        continue;
      }

      const encounterTime = parseEncounterTime(enc.encounterTime);
      const windowSeconds = 3600;

      if (isDuplicate(enc.contentId, encounterTime, windowSeconds)) {
        duplicates += 1;
        continue;
      }

      const [characterName] = enc.nameAtWorld.split('@');

      insertEncounterRecord({
        contentId: enc.contentId,
        characterName,
        worldId: enc.worldId,
        territoryId: enc.territoryId,
        encounterTime,
        uploaderCid
      });

      updatePlayerActivitySummary({
        contentId: enc.contentId,
        characterName,
        worldId: enc.worldId,
        encounterTime
      });

      received += 1;
    }

    return res.json({
      success: true,
      received,
      duplicates,
      invalid,
      message: `数据已接收，处理了${received}条记录，跳过${duplicates}条重复数据`
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/activity/statistics
 */
async function getStatistics(req, res, next) {
  try {
    const { world_id, start_date, end_date, days } = req.query;

    const worldId = world_id ? Number(world_id) : undefined;
    if (world_id && Number.isNaN(worldId)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_params',
        message: 'world_id 必须为数字'
      });
    }

    let startDate = start_date || undefined;
    let endDate = end_date || undefined;
    let daysInt = days ? Number(days) : 7;
    if (Number.isNaN(daysInt) || daysInt <= 0) {
      daysInt = 7;
    }

    // 如果未提供日期范围，则使用最近 N 天
    if (!startDate || !endDate) {
      const end = new Date();
      const start = new Date(end.getTime() - (daysInt - 1) * 24 * 3600 * 1000);

      const toDateStr = (d) => d.toISOString().slice(0, 10);
      startDate = startDate || toDateStr(start);
      endDate = endDate || toDateStr(end);
    }

    const dailyRows = queryWorldStatistics({ worldId, startDate, endDate });

    // 汇总总体统计
    const statistics = {};

    dailyRows.forEach((row) => {
      const wid = row.world_id;
      if (!statistics[wid]) {
        statistics[wid] = {
          world_id: wid,
          total_unique_players: 0,
          total_encounters: 0,
          daily_stats: []
        };
      }

      statistics[wid].total_unique_players += row.unique_players;
      statistics[wid].total_encounters += row.total_encounters;
      statistics[wid].daily_stats.push({
        date: row.stat_date,
        unique_players: row.unique_players,
        total_encounters: row.total_encounters
      });
    });

    let responseStats;
    if (worldId) {
      responseStats = statistics[worldId] || {
        world_id: worldId,
        total_unique_players: 0,
        total_encounters: 0,
        daily_stats: []
      };

      responseStats.top_territories = queryTopTerritories(worldId, daysInt).map((t) => ({
        territory_id: t.territory_id,
        territory_name: '', // 目前没有地图名称映射，保留字段
        unique_players: t.unique_players,
        encounters: t.encounters
      }));
    } else {
      const leaderboard = queryWorldLeaderboard(daysInt);
      responseStats = {
        leaderboard: leaderboard.map((w) => ({
          world_id: w.world_id,
          total_unique_players: w.total_unique_players,
          total_encounters: w.total_encounters
        })),
        worlds: Object.values(statistics)
      };
    }

    return res.json({
      success: true,
      query: {
        world_id: worldId,
        start_date: startDate,
        end_date: endDate,
        days: daysInt
      },
      statistics: responseStats,
      last_update: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/activity/players
 * 列出已上传的玩家信息
 */
async function getPlayers(req, res, next) {
  try {
    const { world_id, search, cid, limit = 100, offset = 0 } = req.query;

    const worldId = world_id ? Number(world_id) : undefined;
    if (world_id && Number.isNaN(worldId)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_params',
        message: 'world_id 必须为数字'
      });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const searchTerm = search ? String(search).trim() : undefined;
    const contentId = cid ? String(cid).trim() : undefined;

    if (contentId && !/^\d+$/.test(contentId)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_params',
        message: 'cid 必须是数字'
      });
    }

    const filters = {
      worldId,
      search: searchTerm,
      cid: contentId
    };

    const players = listPlayers({
      ...filters,
      limit: parsedLimit,
      offset: parsedOffset
    });

    const total = countPlayers(filters);

    return res.json({
      success: true,
      players,
      total,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  batchUpload,
  getStatistics,
  getPlayers
};
