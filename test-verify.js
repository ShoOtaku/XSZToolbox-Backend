/**
 * 验证测试工具
 * 用于测试 CID 哈希计算和后端验证 API
 */

const crypto = require('crypto');
const axios = require('axios');

/**
 * 计算 CID 哈希（与客户端算法一致）
 * @param {string} contentId - 明文 CID
 * @returns {string} SHA256 哈希（大写）
 */
function computeCIDHash(contentId) {
  const salt = 'XSZToolbox_CID_Salt_2025';
  const input = `${salt}${contentId}`;
  return crypto.createHash('sha256')
    .update(input)
    .digest('hex')
    .toUpperCase();
}

/**
 * 测试验证功能
 * @param {string} cid - 明文 CID
 * @param {string} apiBaseUrl - API 基础 URL（默认：http://localhost:3000/api）
 */
async function testVerify(cid, apiBaseUrl = 'http://localhost:3000/api') {
  console.log('\n========================================');
  console.log('🔍 XSZToolbox 验证测试');
  console.log('========================================\n');

  // 1. 计算哈希
  console.log('📝 步骤 1: 计算 CID 哈希');
  console.log(`   CID (明文): ${cid}`);

  const hash = computeCIDHash(cid);
  console.log(`   CID Hash:   ${hash}`);
  console.log(`   算法:       SHA256(Salt + CID)`);
  console.log(`   盐值:       XSZToolbox_CID_Salt_2025\n`);

  // 2. 测试验证 API
  console.log('🌐 步骤 2: 测试验证 API');
  console.log(`   API URL:    ${apiBaseUrl}/verify/${hash}\n`);

  try {
    const startTime = Date.now();
    const response = await axios.get(`${apiBaseUrl}/verify/${hash}`, {
      timeout: 10000 // 10秒超时
    });
    const endTime = Date.now();

    console.log('✅ API 请求成功');
    console.log(`   HTTP 状态:  ${response.status} ${response.statusText}`);
    console.log(`   响应时间:   ${endTime - startTime}ms\n`);

    console.log('📦 响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // 3. 分析结果
    console.log('========================================');
    console.log('📊 验证结果分析');
    console.log('========================================\n');

    const { authorized, status, note, permissions } = response.data;

    if (authorized === true) {
      console.log('✅ 验证通过！用户已授权');
      console.log(`   状态:       ${status}`);
      if (note) {
        console.log(`   备注:       ${note}`);
      }
      if (permissions) {
        console.log(`   权限:       ${JSON.stringify(permissions)}`);
      }
    } else {
      console.log('❌ 验证未通过');
      console.log(`   状态:       ${status}`);
      console.log(`   原因:       用户不在白名单中`);
      console.log('\n💡 可能的解决方案:');
      console.log('   1. 确认 CID 已添加到后端白名单');
      console.log('   2. 运行 fix-whitelist-hashes.js 修复数据库哈希');
      console.log('   3. 检查数据库 whitelist 表中的 authorized 字段是否为 1');
      console.log('   4. 确认哈希计算算法与客户端一致（Salt + CID）');
    }

  } catch (error) {
    console.error('❌ API 请求失败\n');

    if (error.response) {
      // 服务器返回了错误响应
      console.error(`   HTTP 状态:  ${error.response.status} ${error.response.statusText}`);
      console.error('   响应数据:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('   错误:       无法连接到服务器');
      console.error(`   URL:        ${apiBaseUrl}/verify/${hash}`);
      console.error('\n💡 可能的原因:');
      console.error('   1. 后端服务未启动（运行 npm run dev）');
      console.error('   2. 端口号不正确（检查 API URL）');
      console.error('   3. 防火墙阻止了连接');
    } else {
      // 其他错误
      console.error(`   错误:       ${error.message}`);
    }

    console.error('');
  }

  console.log('========================================');
  console.log('🏁 测试结束');
  console.log('========================================\n');
}

/**
 * 批量测试多个 CID
 */
async function batchTest(cids, apiBaseUrl) {
  console.log('\n========================================');
  console.log('📋 批量验证测试');
  console.log(`   测试数量: ${cids.length}`);
  console.log('========================================');

  for (let i = 0; i < cids.length; i++) {
    console.log(`\n[${i + 1}/${cids.length}] 测试 CID: ${cids[i]}`);
    await testVerify(cids[i], apiBaseUrl);

    // 避免请求过快
    if (i < cids.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// 命令行参数解析
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n========================================');
  console.log('📖 XSZToolbox 验证测试工具 - 使用说明');
  console.log('========================================\n');
  console.log('用法:');
  console.log('  node test-verify.js <CID> [API_URL]\n');
  console.log('参数:');
  console.log('  CID       - 玩家的 Content ID（明文）');
  console.log('  API_URL   - 后端 API 地址（可选，默认: http://localhost:3000/api）\n');
  console.log('示例:');
  console.log('  node test-verify.js 18014449511126809');
  console.log('  node test-verify.js 18014449511126809 http://localhost:3000/api');
  console.log('  node test-verify.js 18014449511126809 https://your-server.com/api\n');
  console.log('批量测试:');
  console.log('  在代码中修改 BATCH_TEST_CIDS 数组，然后运行:');
  console.log('  node test-verify.js --batch\n');
  process.exit(0);
}

// 批量测试模式
if (args[0] === '--batch') {
  const BATCH_TEST_CIDS = [
    // 在这里添加要测试的 CID
    // '18014449511126809',
    // '18014449511126810',
  ];

  if (BATCH_TEST_CIDS.length === 0) {
    console.error('\n❌ 错误: 批量测试 CID 列表为空');
    console.error('请在代码中修改 BATCH_TEST_CIDS 数组\n');
    process.exit(1);
  }

  const apiUrl = args[1] || 'http://localhost:3000/api';
  batchTest(BATCH_TEST_CIDS, apiUrl)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ 批量测试失败:', error.message);
      process.exit(1);
    });
} else {
  // 单个测试模式
  const cid = args[0];
  const apiUrl = args[1] || 'http://localhost:3000/api';

  testVerify(cid, apiUrl)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ 测试失败:', error.message);
      process.exit(1);
    });
}
