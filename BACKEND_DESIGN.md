# XSZToolbox 服务器活跃度收集系统 - 后端设计文档

## 📋 系统概述

本系统用于收集FFXIV玩家的遭遇数据，统计各服务器的活跃玩家人数。客户端插件会定时扫描周围玩家并上传数据，后端负责接收、去重、存储和统计。

### 核心功能
- ✅ 接收客户端批量上传的玩家遭遇数据
- ✅ 数据去重（防止短时间内重复记录）
- ✅ CID与角色名一致性验证（防止混淆插件数据）
- ✅ 统计各服务器活跃玩家数量
- ✅ 提供统计查询API

---

## 🗄️ 数据库设计

### 1. encounter_records (遭遇记录表)

存储所有玩家遭遇的原始数据。

```sql
CREATE TABLE encounter_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    content_id BIGINT NOT NULL COMMENT '被遭遇玩家的CID',
    character_name VARCHAR(100) NOT NULL COMMENT '角色名',
    world_id SMALLINT NOT NULL COMMENT '服务器ID',
    territory_id SMALLINT NOT NULL COMMENT '地图ID',
    encounter_time DATETIME NOT NULL COMMENT '遭遇时间（UTC）',
    uploader_cid BIGINT NOT NULL COMMENT '上传者CID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',

    INDEX idx_content_id (content_id),
    INDEX idx_world_id (world_id),
    INDEX idx_encounter_time (encounter_time),
    INDEX idx_uploader_cid (uploader_cid),
    INDEX idx_territory_id (territory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家遭遇原始记录';
```

**字段说明：**
- `id`: 自增主键
- `content_id`: 被遭遇玩家的CID（明文存储）
- `character_name`: 角色名（用于验证CID正确性）
- `world_id`: 服务器ID（如1167=紫水栈桥, 1042=拉诺西亚）
- `territory_id`: 地图ID（可用于分析玩家在哪些地图活跃）
- `encounter_time`: 遭遇发生的时间（UTC时区）
- `uploader_cid`: 上传数据的玩家CID（用于防刷和数据质量分析）
- `created_at`: 数据库记录创建时间

**索引说明：**
- `idx_content_id`: 用于按玩家查询遭遇记录
- `idx_world_id`: 用于按服务器统计活跃度
- `idx_encounter_time`: 用于按时间范围查询
- `idx_uploader_cid`: 用于分析上传者行为
- `idx_territory_id`: 用于分析地图热度

---

### 2. player_activity_summary (玩家活跃度汇总表)

每个玩家的活跃度汇总数据，用于快速查询和统计。

```sql
CREATE TABLE player_activity_summary (
    content_id BIGINT PRIMARY KEY COMMENT '玩家CID',
    character_name VARCHAR(100) NOT NULL COMMENT '角色名',
    world_id SMALLINT NOT NULL COMMENT '服务器ID',
    last_seen DATETIME NOT NULL COMMENT '最后被看到的时间',
    encounter_count INT DEFAULT 1 COMMENT '被遭遇总次数',
    unique_uploaders INT DEFAULT 1 COMMENT '不同上传者数量',
    first_seen DATETIME NOT NULL COMMENT '首次被看到时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_world_id (world_id),
    INDEX idx_last_seen (last_seen),
    INDEX idx_encounter_count (encounter_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家活跃度汇总';
```

**字段说明：**
- `content_id`: 玩家CID（主键）
- `character_name`: 最新的角色名
- `world_id`: 服务器ID
- `last_seen`: 最后一次被遭遇的时间
- `encounter_count`: 累计被遭遇次数
- `unique_uploaders`: 有多少不同的玩家上传过该CID的数据
- `first_seen`: 首次被记录的时间
- `updated_at`: 记录最后更新时间

**更新逻辑：**
- 每次接收新数据时，使用 `INSERT ... ON DUPLICATE KEY UPDATE` 更新汇总表
- 更新 `last_seen`、增加 `encounter_count`、更新 `character_name`

---

### 3. world_statistics (服务器统计表)

按日期统计各服务器的活跃度数据。

```sql
CREATE TABLE world_statistics (
    world_id SMALLINT NOT NULL COMMENT '服务器ID',
    stat_date DATE NOT NULL COMMENT '统计日期',
    unique_players INT DEFAULT 0 COMMENT '当日不重复玩家数',
    total_encounters INT DEFAULT 0 COMMENT '当日总遭遇次数',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (world_id, stat_date),
    INDEX idx_stat_date (stat_date),
    INDEX idx_unique_players (unique_players)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务器活跃度统计';
```

**字段说明：**
- `world_id`: 服务器ID
- `stat_date`: 统计日期（按天）
- `unique_players`: 当天该服务器有多少不同的玩家被遭遇
- `total_encounters`: 当天该服务器的总遭遇次数
- `updated_at`: 记录更新时间

**更新策略：**
- 使用定时任务（如每小时一次）从 `encounter_records` 聚合数据
- 或者每次接收数据时实时增量更新

---

## 🔌 API接口设计

### 1. POST /api/activity/batch

**功能：** 批量上传玩家遭遇数据

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
{
  "uploaderCid": 12345678901234567,
  "encounters": [
    {
      "contentId": 98765432109876543,
      "nameAtWorld": "角色名@紫水栈桥",
      "worldId": 1167,
      "territoryId": 478,
      "encounterTime": "2025-11-17T14:30:00Z"
    },
    {
      "contentId": 11111111111111111,
      "nameAtWorld": "角色名2@拉诺西亚",
      "worldId": 1042,
      "territoryId": 478,
      "encounterTime": "2025-11-17T14:32:00Z"
    }
  ],
  "uploadTime": "2025-11-17T14:35:00Z"
}
```

**字段说明：**
- `uploaderCid`: 上传者的CID（明文，用于防刷）
- `encounters`: 遭遇数据数组
  - `contentId`: 被遭遇玩家的CID（明文）
  - `nameAtWorld`: 角色名@服务器名（格式化字符串）
  - `worldId`: 服务器ID（数值）
  - `territoryId`: 地图ID
  - `encounterTime`: 遭遇时间（ISO 8601格式，UTC时区）
- `uploadTime`: 客户端上传时间戳

**响应示例（成功）：**
```json
{
  "success": true,
  "received": 42,
  "duplicates": 5,
  "invalid": 0,
  "message": "数据已接收，处理了42条记录，跳过5条重复数据"
}
```

**响应示例（失败）：**
```json
{
  "success": false,
  "error": "invalid_data",
  "message": "数据格式错误：encounters字段为空"
}
```

**HTTP状态码：**
- `200 OK`: 成功接收数据
- `400 Bad Request`: 请求数据格式错误
- `429 Too Many Requests`: 请求过于频繁（防刷）
- `500 Internal Server Error`: 服务器内部错误

**后端处理逻辑：**

```python
def handle_batch_upload(request_data):
    uploader_cid = request_data['uploaderCid']
    encounters = request_data['encounters']

    # 1. 防刷检查：单个上传者每小时最多上传1000条
    if check_rate_limit(uploader_cid, limit=1000, window=3600):
        return {'success': False, 'error': 'rate_limit_exceeded'}

    received = 0
    duplicates = 0
    invalid = 0

    for encounter in encounters:
        content_id = encounter['contentId']
        name_at_world = encounter['nameAtWorld']
        world_id = encounter['worldId']
        territory_id = encounter['territoryId']
        encounter_time = parse_datetime(encounter['encounterTime'])

        # 2. 数据验证
        if not validate_encounter_data(encounter):
            invalid += 1
            continue

        # 3. 去重检查：相同CID在1小时内只保留一条记录
        if is_duplicate(content_id, encounter_time, window=3600):
            duplicates += 1
            continue

        # 4. 插入原始记录
        insert_encounter_record(
            content_id=content_id,
            character_name=name_at_world.split('@')[0],
            world_id=world_id,
            territory_id=territory_id,
            encounter_time=encounter_time,
            uploader_cid=uploader_cid
        )

        # 5. 更新汇总表
        update_player_activity_summary(
            content_id=content_id,
            character_name=name_at_world.split('@')[0],
            world_id=world_id,
            encounter_time=encounter_time,
            uploader_cid=uploader_cid
        )

        received += 1

    return {
        'success': True,
        'received': received,
        'duplicates': duplicates,
        'invalid': invalid,
        'message': f'处理了{received}条记录，跳过{duplicates}条重复数据'
    }
```

**SQL示例 - 插入原始记录：**
```sql
INSERT INTO encounter_records (
    content_id, character_name, world_id,
    territory_id, encounter_time, uploader_cid
)
VALUES (?, ?, ?, ?, ?, ?);
```

**SQL示例 - 更新汇总表：**
```sql
INSERT INTO player_activity_summary (
    content_id, character_name, world_id,
    last_seen, encounter_count, unique_uploaders, first_seen
)
VALUES (?, ?, ?, ?, 1, 1, ?)
ON DUPLICATE KEY UPDATE
    character_name = VALUES(character_name),
    last_seen = VALUES(last_seen),
    encounter_count = encounter_count + 1,
    unique_uploaders = (
        SELECT COUNT(DISTINCT uploader_cid)
        FROM encounter_records
        WHERE content_id = VALUES(content_id)
    );
```

---

### 2. GET /api/activity/statistics

**功能：** 查询服务器活跃度统计数据

**请求参数：**
- `world_id` (可选): 服务器ID，不提供则返回所有服务器
- `start_date` (可选): 开始日期 (YYYY-MM-DD格式)
- `end_date` (可选): 结束日期 (YYYY-MM-DD格式)
- `days` (可选): 最近N天（默认7天）

**请求示例：**
```
GET /api/activity/statistics?world_id=1167&days=7
GET /api/activity/statistics?start_date=2025-11-10&end_date=2025-11-17
GET /api/activity/statistics
```

**响应示例：**
```json
{
  "success": true,
  "query": {
    "world_id": 1167,
    "start_date": "2025-11-10",
    "end_date": "2025-11-17",
    "days": 7
  },
  "statistics": {
    "world_name": "紫水栈桥",
    "world_id": 1167,
    "total_unique_players": 3845,
    "total_encounters": 12678,
    "daily_stats": [
      {
        "date": "2025-11-17",
        "unique_players": 642,
        "total_encounters": 2134
      },
      {
        "date": "2025-11-16",
        "unique_players": 589,
        "total_encounters": 1987
      }
    ],
    "top_territories": [
      {
        "territory_id": 478,
        "territory_name": "利姆萨·罗敏萨",
        "unique_players": 1234,
        "encounters": 4567
      }
    ]
  },
  "last_update": "2025-11-17T14:35:00Z"
}
```

**SQL查询示例 - 服务器统计：**
```sql
-- 查询指定服务器最近7天的统计
SELECT
    stat_date,
    unique_players,
    total_encounters
FROM world_statistics
WHERE world_id = ?
  AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY stat_date DESC;

-- 查询所有服务器的排行榜（最近7天）
SELECT
    ws.world_id,
    w.world_name,
    SUM(ws.unique_players) as total_unique_players,
    SUM(ws.total_encounters) as total_encounters
FROM world_statistics ws
LEFT JOIN worlds w ON ws.world_id = w.id
WHERE ws.stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY ws.world_id
ORDER BY total_unique_players DESC
LIMIT 20;
```

**SQL查询示例 - 地图热度：**
```sql
-- 查询指定服务器最热门的地图（最近7天）
SELECT
    territory_id,
    COUNT(DISTINCT content_id) as unique_players,
    COUNT(*) as total_encounters
FROM encounter_records
WHERE world_id = ?
  AND encounter_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY territory_id
ORDER BY unique_players DESC
LIMIT 10;
```

---

## 🔒 数据处理与安全

### 去重策略

**1. 短时间去重（1小时窗口）**
```sql
-- 检查1小时内是否已有相同CID的记录
SELECT COUNT(*) FROM encounter_records
WHERE content_id = ?
  AND encounter_time >= DATE_SUB(?, INTERVAL 1 HOUR);
```

**2. 使用Redis缓存去重（推荐）**
```python
# 使用Redis Set存储最近1小时的CID
key = f"encounter:recent:{hour_bucket}"
redis.sadd(key, content_id)
redis.expire(key, 3600)

# 检查去重
if redis.sismember(key, content_id):
    return "duplicate"
```

### CID与角色名验证

**目的：** 检测混淆插件或恶意数据

```sql
-- 查询该CID历史上使用过的角色名
SELECT
    character_name,
    COUNT(*) as frequency
FROM encounter_records
WHERE content_id = ?
GROUP BY character_name
ORDER BY frequency DESC;

-- 如果同一个CID有多个不同的角色名，标记为可疑
UPDATE player_activity_summary
SET is_suspicious = 1
WHERE content_id = ?
  AND (
      SELECT COUNT(DISTINCT character_name)
      FROM encounter_records
      WHERE content_id = player_activity_summary.content_id
  ) > 1;
```

### 防刷机制

**1. 上传频率限制**
```python
# 使用Redis限制上传频率
key = f"uploader_limit:{uploader_cid}:{hour}"
count = redis.incr(key)
redis.expire(key, 3600)

if count > 1000:  # 每小时最多1000条
    return "rate_limit_exceeded"
```

**2. 检测异常上传模式**
```sql
-- 检测短时间内上传大量不同CID的异常行为
SELECT
    uploader_cid,
    COUNT(DISTINCT content_id) as unique_players,
    COUNT(*) as total_uploads,
    MIN(created_at) as first_upload,
    MAX(created_at) as last_upload
FROM encounter_records
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
GROUP BY uploader_cid
HAVING COUNT(DISTINCT content_id) > 100  -- 10分钟内遇到100个不同玩家（异常）
ORDER BY unique_players DESC;
```

---

## 📊 统计汇总任务

### 定时任务：每小时汇总统计

```python
def hourly_statistics_job():
    """
    每小时执行一次，汇总过去1小时的数据到 world_statistics 表
    """
    current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
    last_hour = current_hour - timedelta(hours=1)

    # 汇总每个服务器的统计
    query = """
    INSERT INTO world_statistics (world_id, stat_date, unique_players, total_encounters)
    SELECT
        world_id,
        DATE(encounter_time) as stat_date,
        COUNT(DISTINCT content_id) as unique_players,
        COUNT(*) as total_encounters
    FROM encounter_records
    WHERE encounter_time >= ? AND encounter_time < ?
    GROUP BY world_id, DATE(encounter_time)
    ON DUPLICATE KEY UPDATE
        unique_players = unique_players + VALUES(unique_players),
        total_encounters = total_encounters + VALUES(total_encounters);
    """

    execute_query(query, (last_hour, current_hour))
```

**Cron表达式：**
```
0 * * * * /path/to/hourly_statistics_job.py
```

---

## 🚀 性能优化建议

### 1. 索引优化
- ✅ 已为常用查询字段添加索引
- ✅ 使用复合索引加速多条件查询
- ⚠️ 注意索引维护开销，定期分析慢查询

### 2. 分区表（数据量大时）
```sql
-- 按月份分区 encounter_records 表
ALTER TABLE encounter_records
PARTITION BY RANGE (TO_DAYS(encounter_time)) (
    PARTITION p202511 VALUES LESS THAN (TO_DAYS('2025-12-01')),
    PARTITION p202512 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p202601 VALUES LESS THAN (TO_DAYS('2026-02-01')),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### 3. 读写分离
- 主库：处理写入（上传数据）
- 从库：处理查询（统计API）

### 4. 缓存策略
- 使用Redis缓存热门统计查询结果（TTL=5分钟）
- 缓存服务器排行榜（TTL=10分钟）

### 5. 批量写入优化
```python
# 使用批量插入代替单条插入
values = [(cid, name, world_id, territory_id, time, uploader)
          for encounter in encounters]
cursor.executemany(insert_query, values)
```

---

## 📈 监控指标

### 关键指标
1. **数据量监控**
   - 每日新增记录数
   - 数据库总记录数
   - 各服务器记录分布

2. **性能监控**
   - API响应时间（P50, P95, P99）
   - 数据库慢查询数量
   - 上传失败率

3. **数据质量**
   - 去重率（跳过的重复数据比例）
   - 可疑数据比例（CID-名字不一致）
   - 异常上传者数量

### 告警阈值
- 上传API响应时间 > 2秒
- 单小时去重率 > 50%
- 数据库连接数 > 80%
- 磁盘使用率 > 85%

---

## 🛠️ 部署建议

### 技术栈推荐
- **后端框架**: FastAPI (Python) / Express (Node.js) / Spring Boot (Java)
- **数据库**: MySQL 8.0+ / PostgreSQL 14+
- **缓存**: Redis 6.0+
- **消息队列**: RabbitMQ / Kafka（处理高并发上传）

### 环境配置
```bash
# MySQL配置优化
innodb_buffer_pool_size = 4G
innodb_flush_log_at_trx_commit = 2
max_connections = 500

# Redis配置
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## 📞 总结

本设计文档提供了完整的后端实现方案，包括：
- ✅ 3张数据库表（原始记录、汇总表、统计表）
- ✅ 2个核心API接口（上传、查询）
- ✅ 数据去重和验证策略
- ✅ 统计汇总任务
- ✅ 性能优化建议

### 快速开始检查清单

**数据库准备：**
- [ ] 创建数据库 `xsz_activity`
- [ ] 执行表结构DDL（encounter_records, player_activity_summary, world_statistics）
- [ ] 配置索引和分区（可选）

**API实现：**
- [ ] 实现 `POST /api/activity/batch` 端点
- [ ] 实现 `GET /api/activity/statistics` 端点
- [ ] 添加请求验证和错误处理
- [ ] 配置CORS（如需要）

**后台任务：**
- [ ] 实现每小时统计汇总任务
- [ ] 配置Cron定时执行

**测试：**
- [ ] 单元测试（数据验证、去重逻辑）
- [ ] 集成测试（API端到端）
- [ ] 性能测试（并发上传）

**监控：**
- [ ] 配置日志记录
- [ ] 设置性能监控
- [ ] 配置告警规则
