# 焊接数据管理权限说明

## 权限体系

### 1. 查看权限
- **权限代码**: `welding_data:read`
- **权限名称**: 焊接数据管理 - 查看
- **用途**: 查看焊接数据统计和同步结果
- **API端点**:
  - `GET /api/external-data/welding/statistics` - 查看统计数据
  - `GET /api/reports/vfactdb/sync-welding/latest` - 查看同步结果

### 2. 配置管理权限

#### 2.1 查看配置
- **权限代码**: `welding_data:config:read`
- **权限名称**: 焊接数据配置 - 查看
- **用途**: 查看配置（Marka代码、非标准图纸、ConstContractor映射）
- **API端点**:
  - `GET /api/external-data/welding/marka-codes`
  - `GET /api/external-data/welding/non-standard-drawings`
  - `GET /api/external-data/welding/constcontractor-mappings`

#### 2.2 创建配置
- **权限代码**: `welding_data:config:create`
- **权限名称**: 焊接数据配置 - 创建
- **用途**: 创建配置
- **API端点**:
  - `POST /api/external-data/welding/marka-codes`
  - `POST /api/external-data/welding/non-standard-drawings`
  - `POST /api/external-data/welding/constcontractor-mappings`

#### 2.3 更新配置
- **权限代码**: `welding_data:config:update`
- **权限名称**: 焊接数据配置 - 更新
- **用途**: 更新配置
- **API端点**:
  - `PUT /api/external-data/welding/marka-codes/{id}`
  - `PUT /api/external-data/welding/non-standard-drawings/{id}`
  - `PUT /api/external-data/welding/constcontractor-mappings/{id}`

#### 2.4 删除配置
- **权限代码**: `welding_data:config:delete`
- **权限名称**: 焊接数据配置 - 删除
- **用途**: 删除配置
- **API端点**:
  - `DELETE /api/external-data/welding/marka-codes/{id}`
  - `DELETE /api/external-data/welding/non-standard-drawings/{id}`
  - `DELETE /api/external-data/welding/constcontractor-mappings/{id}`

### 3. 同步权限
- **权限代码**: `welding_data:sync`
- **权限名称**: 焊接数据 - 同步
- **用途**: 启动焊接数据同步（从WeldingList同步到VFACTDB）
- **API端点**:
  - `POST /api/reports/vfactdb/sync-welding`

## 权限分配建议

### 普通用户
- `welding_data:read` - 可以查看统计和同步结果

### 配置管理员
- `welding_data:read` - 查看统计和同步结果
- `welding_data:config:read` - 查看配置
- `welding_data:config:create` - 创建配置
- `welding_data:config:update` - 更新配置
- `welding_data:config:delete` - 删除配置

### 同步操作员
- `welding_data:read` - 查看统计和同步结果
- `welding_data:sync` - 启动同步

### 系统管理员
- 所有权限（通过 `is_superuser` 标志）

## 注意事项

1. **与VFACTDB权限的分离**: 
   - 焊接数据管理权限不影响VFACTDB的查看和创建
   - VFACTDB使用独立的 `daily_report:read` 和 `daily_report:create` 权限

2. **权限继承**:
   - 超级管理员自动拥有所有权限
   - 可以通过角色批量分配权限

3. **权限初始化**:
   - 运行 `python scripts/init_permissions.py` 初始化权限
   - 新权限会自动创建，已存在的权限不会重复创建

