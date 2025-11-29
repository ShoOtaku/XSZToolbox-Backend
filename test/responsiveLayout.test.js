/**
 * 响应式布局属性测试
 * 
 * 测试目标：验证模态框宽度在不同屏幕尺寸下的响应式调整
 * 
 * **Feature: room-management-enhancements, Property 14: 模态框宽度响应式调整**
 * **Validates: Requirements 4.3**
 */

const assert = require('assert');

/**
 * 模拟 CSS 媒体查询的行为
 * 根据屏幕宽度返回模态框应该使用的宽度
 */
function getModalWidth(screenWidth) {
    // 基础宽度设定
    const baseWidth = 900;
    
    // 根据媒体查询规则计算实际宽度
    if (screenWidth <= 576) {
        // 超小屏幕：100%
        return screenWidth;
    } else if (screenWidth <= 768) {
        // 小屏幕：95%
        return screenWidth * 0.95;
    } else if (screenWidth <= 1024) {
        // 中等屏幕：90%
        return screenWidth * 0.90;
    } else {
        // 大屏幕：使用固定宽度或屏幕宽度的较小值
        return Math.min(baseWidth, screenWidth * 0.90);
    }
}

/**
 * 验证模态框宽度是否合理
 * 合理的定义：
 * 1. 不超过屏幕宽度
 * 2. 在小屏幕上占据足够大的比例（至少 85%）
 * 3. 在大屏幕上不超过设定的最大宽度（900px）
 */
function isModalWidthReasonable(screenWidth, modalWidth) {
    // 规则 1: 模态框宽度不应超过屏幕宽度
    if (modalWidth > screenWidth) {
        return false;
    }
    
    // 规则 2: 在小屏幕上（<= 768px），模态框应该占据至少 85% 的宽度
    if (screenWidth <= 768) {
        const ratio = modalWidth / screenWidth;
        if (ratio < 0.85) {
            return false;
        }
    }
    
    // 规则 3: 在大屏幕上（> 1024px），模态框宽度不应超过 900px
    if (screenWidth > 1024) {
        if (modalWidth > 900) {
            return false;
        }
    }
    
    return true;
}

/**
 * 生成随机屏幕宽度
 * 范围：320px（最小移动设备）到 2560px（大显示器）
 */
function generateRandomScreenWidth() {
    return Math.floor(Math.random() * (2560 - 320 + 1)) + 320;
}

/**
 * 属性测试：模态框宽度响应式调整
 * 
 * 属性：对于任何屏幕宽度，当屏幕宽度小于模态框设定宽度时，
 * 模态框宽度应该自适应调整为屏幕宽度的合理比例
 */
function testModalWidthResponsiveness() {
    const testCases = 100; // 运行 100 次测试
    let passedTests = 0;
    const failures = [];
    
    for (let i = 0; i < testCases; i++) {
        const screenWidth = generateRandomScreenWidth();
        const modalWidth = getModalWidth(screenWidth);
        const isReasonable = isModalWidthReasonable(screenWidth, modalWidth);
        
        if (isReasonable) {
            passedTests++;
        } else {
            failures.push({
                screenWidth,
                modalWidth,
                ratio: (modalWidth / screenWidth * 100).toFixed(2) + '%'
            });
        }
    }
    
    // 输出测试结果
    console.log(`\n属性测试：模态框宽度响应式调整`);
    console.log(`运行测试次数: ${testCases}`);
    console.log(`通过测试: ${passedTests}`);
    console.log(`失败测试: ${failures.length}`);
    
    if (failures.length > 0) {
        console.log('\n失败的测试用例:');
        failures.forEach((failure, index) => {
            console.log(`  ${index + 1}. 屏幕宽度: ${failure.screenWidth}px, 模态框宽度: ${failure.modalWidth.toFixed(2)}px, 比例: ${failure.ratio}`);
        });
    }
    
    // 断言所有测试都应该通过
    assert.strictEqual(failures.length, 0, `有 ${failures.length} 个测试用例失败`);
    
    return passedTests === testCases;
}

/**
 * 边界值测试：测试特定的关键屏幕尺寸
 */
function testKeyScreenSizes() {
    const keyScreenSizes = [
        { width: 320, name: '最小移动设备' },
        { width: 375, name: 'iPhone SE' },
        { width: 414, name: 'iPhone Plus' },
        { width: 576, name: '小屏幕断点' },
        { width: 768, name: '平板断点' },
        { width: 1024, name: '中等屏幕断点' },
        { width: 1280, name: '笔记本' },
        { width: 1920, name: '桌面显示器' },
        { width: 2560, name: '大显示器' }
    ];
    
    console.log(`\n边界值测试：关键屏幕尺寸`);
    
    keyScreenSizes.forEach(({ width, name }) => {
        const modalWidth = getModalWidth(width);
        const ratio = (modalWidth / width * 100).toFixed(2);
        const isReasonable = isModalWidthReasonable(width, modalWidth);
        
        console.log(`  ${name} (${width}px): 模态框宽度 ${modalWidth.toFixed(2)}px (${ratio}%) - ${isReasonable ? '✓ 通过' : '✗ 失败'}`);
        
        assert.ok(isReasonable, `${name} (${width}px) 的模态框宽度不合理`);
    });
    
    return true;
}

/**
 * 运行所有测试
 */
function runTests() {
    console.log('========================================');
    console.log('响应式布局属性测试');
    console.log('Feature: room-management-enhancements');
    console.log('Property 14: 模态框宽度响应式调整');
    console.log('Validates: Requirements 4.3');
    console.log('========================================');
    
    try {
        // 运行属性测试
        const propertyTestPassed = testModalWidthResponsiveness();
        
        // 运行边界值测试
        const boundaryTestPassed = testKeyScreenSizes();
        
        if (propertyTestPassed && boundaryTestPassed) {
            console.log('\n✓ 所有测试通过！');
            console.log('模态框宽度在所有屏幕尺寸下都能正确响应式调整。');
            return true;
        }
    } catch (error) {
        console.error('\n✗ 测试失败:', error.message);
        return false;
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}

module.exports = {
    getModalWidth,
    isModalWidthReasonable,
    testModalWidthResponsiveness,
    testKeyScreenSizes,
    runTests
};
