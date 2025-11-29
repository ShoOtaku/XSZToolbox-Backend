/**
 * 指令历史记录功能测试
 * 测试指令历史的添加、完整性、数量限制和失败状态标记
 */

// 测试辅助函数
function assert(condition, message) {
    if (!condition) {
        throw new Error(`断言失败: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`断言失败: ${message}\n期望: ${expected}\n实际: ${actual}`);
    }
}

// 模拟 App 类的指令历史相关方法
class MockApp {
    constructor() {
        this.currentRoomId = 1;
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            let normalized = dateString;
            if (typeof dateString === 'string') {
                normalized = dateString.replace(' ', 'T');
                if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
                    normalized += 'Z';
                }
            }
            const date = new Date(normalized);
            if (Number.isNaN(date.getTime())) return dateString;
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Shanghai'
            });
        } catch {
            return dateString;
        }
    }

    /**
     * 渲染指令历史列表
     * @param {Array} commands - 指令列表
     * @returns {Object} 渲染结果统计
     */
    renderCommandHistory(commands) {
        if (!commands || commands.length === 0) {
            return { rendered: 0, hasError: false };
        }

        // 限制显示最近 10 条
        const displayCommands = commands.slice(0, 10);

        const commandTypeNames = {
            'move': '移动',
            'jump': '跳跃',
            'setpos': '设置位置',
            'slidetp': '滑步传送',
            'lockpos': '锁定位置',
            'chat': '发送聊天',
            'echo': '回显',
            'stop': '停止'
        };

        const renderedItems = displayCommands.map(cmd => {
            const timestamp = this.formatDate(cmd.sent_at);
            const target = cmd.target_type === 'all' ? '所有成员' : (cmd.target_name || '指定成员');
            const commandType = commandTypeNames[cmd.command_type] || cmd.command_type;
            const status = cmd.status === 'sent' ? '已发送' : '失败';
            
            // 检查必需字段
            const hasRequiredFields = !!(
                cmd.sent_at &&
                cmd.target_type &&
                cmd.command_type &&
                cmd.status
            );

            // 检查失败状态标记
            const hasFailureMarker = cmd.status === 'failed' ? !!(cmd.error) : true;

            return {
                timestamp,
                target,
                commandType,
                status,
                hasRequiredFields,
                hasFailureMarker,
                error: cmd.error
            };
        });

        return {
            rendered: renderedItems.length,
            items: renderedItems,
            hasError: renderedItems.some(item => !item.hasRequiredFields)
        };
    }
}

// ==================== 测试用例 ====================

console.log('开始测试指令历史记录功能...\n');

const app = new MockApp();

// 测试 7.4: 属性 10 - 指令历史记录添加
console.log('测试 7.4: 属性 10 - 指令历史记录添加');
console.log('验证需求: 5.1');

// 模拟指令历史数据
const initialCommands = [
    {
        id: 1,
        room_id: 1,
        target_type: 'all',
        command_type: 'move',
        status: 'sent',
        sent_at: '2025-01-15T10:30:00Z',
        sent_by: 'admin'
    }
];

// 测试用例 1: 初始状态有 1 条记录
let result1 = app.renderCommandHistory(initialCommands);
assertEqual(result1.rendered, 1, '初始状态应该有 1 条记录');
console.log('✅ 测试通过: 初始状态记录数量正确');

// 测试用例 2: 添加新指令后记录增加
const commandsAfterAdd = [
    {
        id: 2,
        room_id: 1,
        target_type: 'single',
        target_name: '测试角色',
        command_type: 'jump',
        status: 'sent',
        sent_at: '2025-01-15T10:31:00Z',
        sent_by: 'admin'
    },
    ...initialCommands
];

let result2 = app.renderCommandHistory(commandsAfterAdd);
assertEqual(result2.rendered, 2, '添加新指令后应该有 2 条记录');
console.log('✅ 测试通过: 新指令添加后记录数量增加');

console.log('\n✅ 属性 10 测试通过：指令历史记录添加\n');

// 测试 7.5: 属性 11 - 指令历史记录完整性
console.log('测试 7.5: 属性 11 - 指令历史记录完整性');
console.log('验证需求: 5.2');

// 测试用例 1: 完整的指令记录应该包含所有必需字段
const completeCommand = {
    id: 1,
    room_id: 1,
    target_type: 'all',
    command_type: 'move',
    command_params: '{"x": 100, "y": 0, "z": 100}',
    status: 'sent',
    sent_at: '2025-01-15T10:30:00Z',
    sent_by: 'admin'
};

let result3 = app.renderCommandHistory([completeCommand]);
assert(result3.rendered === 1, '应该渲染 1 条记录');
assert(result3.items[0].hasRequiredFields === true, '记录应该包含所有必需字段');
assert(result3.items[0].timestamp !== '-', '应该包含时间戳');
assert(result3.items[0].target !== undefined, '应该包含目标成员信息');
assert(result3.items[0].commandType !== undefined, '应该包含指令类型');
assert(result3.items[0].status !== undefined, '应该包含状态信息');
console.log('✅ 测试通过: 完整记录包含所有必需字段');

// 测试用例 2: 缺少必需字段的记录应该被检测到
const incompleteCommand = {
    id: 2,
    room_id: 1,
    // 缺少 target_type
    command_type: 'move',
    status: 'sent',
    // 缺少 sent_at
    sent_by: 'admin'
};

let result4 = app.renderCommandHistory([incompleteCommand]);
assert(result4.items[0].hasRequiredFields === false, '缺少必需字段的记录应该被检测到');
console.log('✅ 测试通过: 缺少必需字段的记录被正确检测');

console.log('\n✅ 属性 11 测试通过：指令历史记录完整性\n');

// 测试 7.6: 属性 12 - 指令历史记录数量限制
console.log('测试 7.6: 属性 12 - 指令历史记录数量限制');
console.log('验证需求: 5.3');

// 测试用例 1: 超过 10 条记录时应该只显示最近 10 条
const manyCommands = [];
for (let i = 1; i <= 15; i++) {
    manyCommands.push({
        id: i,
        room_id: 1,
        target_type: 'all',
        command_type: 'move',
        status: 'sent',
        sent_at: `2025-01-15T10:${30 + i}:00Z`,
        sent_by: 'admin'
    });
}

let result5 = app.renderCommandHistory(manyCommands);
assertEqual(result5.rendered, 10, '超过 10 条记录时应该只显示 10 条');
console.log('✅ 测试通过: 记录数量限制为 10 条');

// 测试用例 2: 少于 10 条记录时应该全部显示
const fewCommands = [];
for (let i = 1; i <= 5; i++) {
    fewCommands.push({
        id: i,
        room_id: 1,
        target_type: 'all',
        command_type: 'move',
        status: 'sent',
        sent_at: `2025-01-15T10:${30 + i}:00Z`,
        sent_by: 'admin'
    });
}

let result6 = app.renderCommandHistory(fewCommands);
assertEqual(result6.rendered, 5, '少于 10 条记录时应该全部显示');
console.log('✅ 测试通过: 少于 10 条记录时全部显示');

// 测试用例 3: 空数组应该返回 0 条记录
let result7 = app.renderCommandHistory([]);
assertEqual(result7.rendered, 0, '空数组应该返回 0 条记录');
console.log('✅ 测试通过: 空数组处理正确');

console.log('\n✅ 属性 12 测试通过：指令历史记录数量限制\n');

// 测试 7.7: 属性 13 - 指令历史失败状态标记
console.log('测试 7.7: 属性 13 - 指令历史失败状态标记');
console.log('验证需求: 5.5');

// 测试用例 1: 失败的指令应该标记失败状态并包含错误原因
const failedCommand = {
    id: 1,
    room_id: 1,
    target_type: 'all',
    command_type: 'move',
    status: 'failed',
    error: '目标成员不在线',
    sent_at: '2025-01-15T10:30:00Z',
    sent_by: 'admin'
};

let result8 = app.renderCommandHistory([failedCommand]);
assert(result8.rendered === 1, '应该渲染 1 条记录');
assert(result8.items[0].status === '失败', '失败的指令应该标记为失败状态');
assert(result8.items[0].hasFailureMarker === true, '失败的指令应该包含错误原因');
assert(result8.items[0].error === '目标成员不在线', '应该包含正确的错误信息');
console.log('✅ 测试通过: 失败指令正确标记状态和错误原因');

// 测试用例 2: 成功的指令不应该有错误标记
const successCommand = {
    id: 2,
    room_id: 1,
    target_type: 'all',
    command_type: 'move',
    status: 'sent',
    sent_at: '2025-01-15T10:31:00Z',
    sent_by: 'admin'
};

let result9 = app.renderCommandHistory([successCommand]);
assert(result9.items[0].status === '已发送', '成功的指令应该标记为已发送状态');
assert(result9.items[0].hasFailureMarker === true, '成功的指令不需要错误标记（hasFailureMarker 为 true 表示通过）');
console.log('✅ 测试通过: 成功指令状态正确');

// 测试用例 3: 混合成功和失败的指令
const mixedCommands = [
    {
        id: 1,
        room_id: 1,
        target_type: 'all',
        command_type: 'move',
        status: 'sent',
        sent_at: '2025-01-15T10:30:00Z',
        sent_by: 'admin'
    },
    {
        id: 2,
        room_id: 1,
        target_type: 'single',
        target_name: '测试角色',
        command_type: 'jump',
        status: 'failed',
        error: '参数无效',
        sent_at: '2025-01-15T10:31:00Z',
        sent_by: 'admin'
    },
    {
        id: 3,
        room_id: 1,
        target_type: 'all',
        command_type: 'chat',
        status: 'sent',
        sent_at: '2025-01-15T10:32:00Z',
        sent_by: 'admin'
    }
];

let result10 = app.renderCommandHistory(mixedCommands);
assertEqual(result10.rendered, 3, '应该渲染 3 条记录');
assert(result10.items[0].status === '已发送', '第 1 条应该是成功状态');
assert(result10.items[1].status === '失败', '第 2 条应该是失败状态');
assert(result10.items[1].error === '参数无效', '第 2 条应该包含错误信息');
assert(result10.items[2].status === '已发送', '第 3 条应该是成功状态');
console.log('✅ 测试通过: 混合状态的指令正确处理');

console.log('\n✅ 属性 13 测试通过：指令历史失败状态标记\n');

console.log('==========================================');
console.log('所有测试完成！');
console.log('==========================================');
console.log('自动化测试: 4 个属性测试');
console.log('- 属性 10: 指令历史记录添加');
console.log('- 属性 11: 指令历史记录完整性');
console.log('- 属性 12: 指令历史记录数量限制');
console.log('- 属性 13: 指令历史失败状态标记');
console.log('==========================================');
