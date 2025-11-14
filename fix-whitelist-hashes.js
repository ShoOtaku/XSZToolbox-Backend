/**
 * 数据库白名单哈希修复工具
 * 将所有白名单用户的哈希值从旧算法（CID + Salt）更新为新算法（Salt + CID）
 */

const crypto = require('crypto');
const dbManager = require('./src/models/database');
const logger = require('./src/utils/logger');

/**
 * 使用正确的算法计算 CID 哈希
 * @param {string} cid - 明文 CID
 * @returns {string} SHA256 哈希（大写）
 */
function computeCorrectHash(cid) {
  const salt = 'XSZToolbox_CID_Salt_2025';
  const input = `${salt}${cid}`;
  return crypto.createHash('sha256')
    .update(input)
    .digest('hex')
    .toUpperCase();
}

/**
 * 主修复函数
 */
async function fixWhitelistHashes() {
  try {
    console.log('========================================');
    console.log('🔧 开始修复白名单哈希值');
    console.log('========================================\n');

    // 初始化数据库连接
    console.log('📡 正在连接数据库...\n');
    const db = dbManager.connect();

    // 查询所有有明文 CID 的白名单记录
    const query = `
      SELECT id, cid, cid_hash, note, authorized
      FROM whitelist
      WHERE cid IS NOT NULL AND cid != ''
      ORDER BY id
    `;

    const users = db.prepare(query).all();

    if (users.length === 0) {
      console.log('⚠️ 未找到需要修复的白名单记录（没有明文 CID）');
      console.log('提示：只有通过新版客户端提交的用户数据才包含明文 CID\n');
      return;
    }

    console.log(`📋 找到 ${users.length} 条白名单记录\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 处理每个用户
    for (const user of users) {
      const { id, cid, cid_hash, note, authorized } = user;

      // 计算正确的哈希
      const correctHash = computeCorrectHash(cid);

      // 检查是否需要更新
      if (cid_hash && cid_hash.toUpperCase() === correctHash) {
        console.log(`✓ [ID ${id}] 哈希已正确，跳过`);
        console.log(`  CID: ${cid}`);
        console.log(`  哈希: ${correctHash}`);
        console.log(`  备注: ${note || '(无)'}\n`);
        skippedCount++;
        continue;
      }

      // 更新哈希
      try {
        const updateStmt = db.prepare(`
          UPDATE whitelist
          SET cid_hash = ?
          WHERE id = ?
        `);

        updateStmt.run(correctHash, id);

        console.log(`✅ [ID ${id}] 哈希已更新`);
        console.log(`  CID: ${cid}`);
        console.log(`  旧哈希: ${cid_hash || '(空)'}`);
        console.log(`  新哈希: ${correctHash}`);
        console.log(`  备注: ${note || '(无)'}\n`);

        updatedCount++;
      } catch (error) {
        console.error(`❌ [ID ${id}] 更新失败: ${error.message}`);
        console.error(`  CID: ${cid}\n`);
        errorCount++;
      }
    }

    // 输出统计结果
    console.log('\n========================================');
    console.log('📊 修复完成统计');
    console.log('========================================');
    console.log(`✅ 成功更新: ${updatedCount} 条`);
    console.log(`✓ 已经正确: ${skippedCount} 条`);
    console.log(`❌ 更新失败: ${errorCount} 条`);
    console.log(`📋 总计处理: ${users.length} 条\n`);

    // 验证修复结果
    if (updatedCount > 0) {
      console.log('🔍 正在验证修复结果...\n');

      const verifyQuery = `
        SELECT id, cid, cid_hash
        FROM whitelist
        WHERE cid IS NOT NULL AND cid != ''
        ORDER BY id
      `;

      const verifyUsers = db.prepare(verifyQuery).all();
      let allCorrect = true;

      for (const user of verifyUsers) {
        const expectedHash = computeCorrectHash(user.cid);
        if (user.cid_hash.toUpperCase() !== expectedHash) {
          console.error(`❌ 验证失败 [ID ${user.id}]: 哈希不匹配`);
          console.error(`  期望: ${expectedHash}`);
          console.error(`  实际: ${user.cid_hash}\n`);
          allCorrect = false;
        }
      }

      if (allCorrect) {
        console.log('✅ 所有哈希值验证通过！\n');
      } else {
        console.error('⚠️ 部分哈希值验证失败，请检查日志\n');
      }
    }

    console.log('========================================');
    console.log('🎉 修复流程结束');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 修复过程发生错误:');
    console.error(error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (dbManager.db) {
      dbManager.db.close();
      console.log('\n📡 数据库连接已关闭');
    }
  }
}

// 运行修复
console.log('\n');
fixWhitelistHashes()
  .then(() => {
    console.log('\n✅ 脚本执行完成\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:');
    console.error(error);
    process.exit(1);
  });
