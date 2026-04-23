# 数据库字段名统一规范

## 统一命名规范

为了统一数据库字段命名，提高代码可维护性和查询一致性，制定以下命名规范：

### 核心字段统一规范

| 业务含义 | 统一字段名 | 旧字段名（需要迁移） |
|---------|-----------|-------------------|
| 作业ID | `activity_id` | `act_id` (activities表) |
| Block | `block` | `gcc_block` (mpdb, vfactdb表) |
| Scope | `scope` | `gcc_scope` (mpdb, vfactdb表) |
| Discipline | `discipline` | `gcc_discipline` (mpdb, vfactdb表) |
| Work Package | `work_package` | `gcc_workpackage` (mpdb, vfactdb表), `workpackage` (activity_summary表) |
| Project | `project` | `gcc_project` (mpdb, vfactdb表) |
| Sub-project | `subproject` | `gcc_subproject` (mpdb, vfactdb表), `subproject_code` (facilities, activity_summary表) |
| Phase | `phase` | `gcc_phase` (mpdb, vfactdb表), `contract_phase` (activities表) |
| Train | `train` | `gcc_train` (mpdb, vfactdb表) |
| Unit | `unit` | `gcc_unit` (mpdb, vfactdb表) |
| Quarter | `bcc_quarter` | 保持不变（业务特定前缀） |

### 需要迁移的表

1. **activities表**
   - `act_id` → `activity_id`
   - `contract_phase` → `phase`

2. **mpdb表**
   - `gcc_block` → `block`
   - `gcc_scope` → `scope`
   - `gcc_discipline` → `discipline`
   - `gcc_workpackage` → `work_package`
   - `gcc_project` → `project`
   - `gcc_subproject` → `subproject`
   - `gcc_phase` → `phase`
   - `gcc_train` → `train`
   - `gcc_unit` → `unit`

3. **vfactdb表**
   - `gcc_block` → `block`
   - `gcc_scope` → `scope`
   - `gcc_discipline` → `discipline`
   - `gcc_workpackage` → `work_package`
   - `gcc_project` → `project`
   - `gcc_subproject` → `subproject`
   - `gcc_phase` → `phase`
   - `gcc_train` → `train`
   - `gcc_unit` → `unit`

4. **activity_summary表**
   - `workpackage` → `work_package`
   - `subproject_code` → `subproject`

5. **facilities表**
   - `subproject_code` → `subproject`

### 迁移步骤

1. 创建迁移脚本，重命名所有字段
2. 更新所有模型文件
3. 更新所有API代码
4. 更新前端代码
5. 更新所有查询和关联代码

