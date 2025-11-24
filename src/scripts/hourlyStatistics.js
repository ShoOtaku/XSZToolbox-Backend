/**
 * 每小时汇总 encounter_records 到 world_statistics
 * 可通过 cron 或手动执行:
 *   node src/scripts/hourlyStatistics.js
 */

require('dotenv').config();

const dbManager = require('../models/database');
const { aggregateWorldStatisticsForRange } = require('../models/activityModel');

function getHourRange() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const end = now;
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  return { start, end };
}

function main() {
  console.log('========================================');
  console.log('  XSZToolbox 活跃度统计 - 每小时汇总');
  console.log('========================================\n');

  try {
    console.log('📦 正在连接数据库...');
    dbManager.connect();

    const { start, end } = getHourRange();
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    console.log(`⏱ 统计时间范围: ${startIso} ~ ${endIso}`);

    aggregateWorldStatisticsForRange(startIso, endIso);

    console.log('✅ 汇总完成');
  } catch (error) {
    console.error('❌ 汇总失败:', error);
    process.exitCode = 1;
  } finally {
    dbManager.close();
  }
}

if (require.main === module) {
  main();
}

