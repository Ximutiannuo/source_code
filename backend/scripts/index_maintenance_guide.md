# 索引维护指南

## 索引的自动维护

### 1. **索引是自动更新的**

当你插入、更新或删除数据时，MySQL **自动维护索引**，无需手动操作。

```sql
-- 插入新记录时，索引自动更新
INSERT INTO vfactdb (activity_id, achieved, date) VALUES ('ACT001', 100, '2024-01-01');
-- ✅ 索引 idx_vfactdb_activity_id 和 idx_vfactdb_activity_achieved 自动更新

-- 更新记录时，索引自动更新
UPDATE vfactdb SET achieved = 200 WHERE id = 1;
-- ✅ 如果 activity_id 或 achieved 改变，相关索引自动更新

-- 删除记录时，索引自动更新
DELETE FROM vfactdb WHERE id = 1;
-- ✅ 索引中的对应条目自动删除
```

### 2. **索引维护的性能成本**

#### 插入性能影响
- **无索引表**：插入 1 条记录 = 1 次磁盘写入
- **有 1 个索引**：插入 1 条记录 = 1 次数据写入 + 1 次索引写入 = **2 次写入**
- **有 3 个索引**：插入 1 条记录 = 1 次数据写入 + 3 次索引写入 = **4 次写入**

**实际影响：**
- 对于你的场景（百万级数据），插入性能影响通常很小（< 10%）
- 查询性能提升（10-100倍）远大于插入性能损失

#### 更新性能影响
- 如果更新的是**索引列**，需要更新索引
- 如果更新的是**非索引列**，不影响索引

```sql
-- 这个更新需要更新索引（因为 achieved 在索引中）
UPDATE vfactdb SET achieved = 200 WHERE id = 1;

-- 这个更新不需要更新索引（其他列不在索引中）
UPDATE vfactdb SET other_field = 'value' WHERE id = 1;
```

### 3. **什么时候需要手动维护索引？**

#### 情况1：索引碎片过多（很少需要）
```sql
-- 检查索引碎片
SHOW TABLE STATUS LIKE 'vfactdb';

-- 如果碎片率 > 30%，可以考虑重建索引
OPTIMIZE TABLE vfactdb;
OPTIMIZE TABLE mpdb;
```

#### 情况2：大量删除数据后（可选）
```sql
-- 如果删除了大量数据（> 50%），可以考虑重建索引
OPTIMIZE TABLE vfactdb;
```

#### 情况3：索引统计信息过期（影响查询优化器）
```sql
-- 更新统计信息（帮助查询优化器选择更好的执行计划）
ANALYZE TABLE vfactdb;
ANALYZE TABLE mpdb;
```

## 最佳实践

### 1. **日常操作（无需特殊处理）**

```python
# 正常插入数据，索引自动维护
db.execute(text("""
    INSERT INTO vfactdb (activity_id, achieved, date)
    VALUES (:activity_id, :achieved, :date)
"""), {
    'activity_id': 'ACT001',
    'achieved': 100,
    'date': '2024-01-01'
})
db.commit()
# ✅ 索引自动更新，无需额外操作
```

### 2. **批量插入优化**

```python
# 批量插入时，可以临时禁用索引（仅用于一次性大量导入）
# 注意：只适用于一次性导入，不适用于日常操作

# 禁用索引（不推荐，除非是大量一次性导入）
# ALTER TABLE vfactdb DISABLE KEYS;

# 批量插入
# ... 大量插入操作 ...

# 重新启用索引
# ALTER TABLE vfactdb ENABLE KEYS;
```

### 3. **定期维护（可选，每月或每季度）**

```sql
-- 更新统计信息（帮助查询优化器）
ANALYZE TABLE vfactdb;
ANALYZE TABLE mpdb;
ANALYZE TABLE activities;

-- 如果发现查询变慢，检查并优化表
OPTIMIZE TABLE vfactdb;  -- 重建索引，消除碎片
```

## 监控索引使用情况

### 1. **检查索引是否被使用**

```sql
-- 查看查询执行计划
EXPLAIN SELECT activity_id, SUM(achieved) 
FROM vfactdb 
WHERE activity_id IS NOT NULL 
GROUP BY activity_id;

-- 查看 key 列，如果显示索引名称，说明使用了索引
-- 如果 key 为 NULL，说明没有使用索引（需要检查）
```

### 2. **检查索引大小**

```sql
-- 查看索引占用的空间
SELECT 
    table_name,
    index_name,
    ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS index_size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'projectcontrols'
AND table_name IN ('vfactdb', 'mpdb')
AND stat_name = 'size'
ORDER BY index_size_mb DESC;
```

### 3. **检查索引碎片**

```sql
-- 查看表状态
SHOW TABLE STATUS LIKE 'vfactdb';

-- Data_free 列显示碎片大小
-- 如果 Data_free 很大（> 表大小的 30%），考虑 OPTIMIZE TABLE
```

## 常见问题

### Q1: 插入数据变慢了，是因为索引吗？

**A:** 可能，但不一定。检查方法：
```sql
-- 1. 检查索引数量
SHOW INDEX FROM vfactdb;

-- 2. 如果索引过多（> 5个），考虑合并或删除不常用的索引

-- 3. 检查是否有其他性能问题（锁、慢查询等）
SHOW PROCESSLIST;
```

### Q2: 什么时候需要重建索引？

**A:** 通常不需要。只有在以下情况才需要：
- 删除了大量数据（> 50%）后
- 索引碎片率 > 30%
- 查询性能明显下降

### Q3: 索引会影响插入性能吗？

**A:** 会，但影响通常很小：
- 1个索引：插入性能下降约 5-10%
- 3个索引：插入性能下降约 15-25%
- 查询性能提升：10-100倍

**结论：** 对于你的场景（查询多，插入少），索引的收益远大于成本。

### Q4: 如何平衡索引数量和性能？

**A:** 原则：
1. **查询频繁的列**：必须有索引
2. **WHERE/JOIN 条件**：必须有索引
3. **GROUP BY/ORDER BY**：建议有索引
4. **不常用的列**：不要创建索引

## 针对你的项目的建议

### 日常操作
- ✅ **无需特殊处理**：正常插入/更新/删除数据，索引自动维护

### 定期维护（每月或每季度）
```sql
-- 更新统计信息（帮助查询优化器）
ANALYZE TABLE vfactdb;
ANALYZE TABLE mpdb;
ANALYZE TABLE activities;
```

### 如果发现查询变慢
1. 检查索引是否被使用：`EXPLAIN` 查询
2. 检查索引碎片：`SHOW TABLE STATUS`
3. 如果碎片多，运行：`OPTIMIZE TABLE vfactdb;`

### 批量导入大量数据时（一次性操作）
```python
# 如果一次性导入百万级数据，可以考虑：
# 1. 先导入数据（不创建索引）
# 2. 导入完成后，再创建索引
# 这样可以加快导入速度

# 但日常操作不需要这样做
```

## 总结

1. **索引是自动维护的**：插入/更新/删除数据时，索引自动更新
2. **无需手动操作**：日常操作不需要特殊处理
3. **定期维护**：每月运行 `ANALYZE TABLE` 更新统计信息
4. **监控性能**：如果查询变慢，检查索引使用情况和碎片

**对于你的项目：**
- 正常插入数据即可，索引会自动更新
- 每月运行一次 `ANALYZE TABLE` 更新统计信息
- 如果发现查询变慢，检查索引使用情况

