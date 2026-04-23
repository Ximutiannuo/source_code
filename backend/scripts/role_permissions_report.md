# 角色权限一览

本文档由 `backend/scripts/list_role_permissions.py --md` 生成，列出各角色拥有的权限及 scope/subproject 范围限制。

**生成时间**：2026-02-27 09:40

---

## C01Construction (id=60)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C01 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C01 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C01 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C01 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C01 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C01 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C01 |
| `daily_report:read` | 日报管理 - 查看 | scope=C01 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C01 |
| `facility:read` | 主项清单管理 - 查看 | scope=C01 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C01 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C01 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C01 |
| `p6_resource:read` | 查看P6资源 | scope=C01 |
| `planning:create` | 计划管理 - 创建 | scope=C01 |
| `planning:delete` | 计划管理 - 删除 | scope=C01 |
| `planning:read` | 计划管理 - 查看 | scope=C01 |
| `planning:update` | 计划管理 - 更新 | scope=C01 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C01 |

## C01Planner (id=4)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C01 |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C01 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C01 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C01 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C01 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C01 |
| `daily_report:create` | 日报管理 - 创建 | scope=C01 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C01 |
| `daily_report:read` | 日报管理 - 查看 | scope=C01 |
| `daily_report:update` | 日报管理 - 更新 | scope=C01 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C01 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C01 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C01 |
| `planning:create` | 计划管理 - 创建 | scope=C01 |
| `planning:delete` | 计划管理 - 删除 | scope=C01 |
| `planning:read` | 计划管理 - 查看 | scope=C01 |
| `planning:update` | 计划管理 - 更新 | scope=C01 |

## C01QAQC (id=48)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C01 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C01 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C01 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C01 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C01 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C01 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C01 |
| `daily_report:read` | 日报管理 - 查看 | scope=C01 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C01 |
| `facility:read` | 主项清单管理 - 查看 | scope=C01 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C01 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C01 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C01 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C01 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C01 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C01 |
| `p6_resource:read` | 查看P6资源 | scope=C01 |
| `planning:create` | 计划管理 - 创建 | scope=C01 |
| `planning:delete` | 计划管理 - 删除 | scope=C01 |
| `planning:read` | 计划管理 - 查看 | scope=C01 |
| `planning:update` | 计划管理 - 更新 | scope=C01 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C01 |

## C02Construction (id=61)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C02 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C02 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C02 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C02 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C02 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C02 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C02 |
| `daily_report:read` | 日报管理 - 查看 | scope=C02 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C02 |
| `facility:read` | 主项清单管理 - 查看 | scope=C02 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C02 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C02 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C02 |
| `p6_resource:read` | 查看P6资源 | scope=C02 |
| `planning:create` | 计划管理 - 创建 | scope=C02 |
| `planning:delete` | 计划管理 - 删除 | scope=C02 |
| `planning:read` | 计划管理 - 查看 | scope=C02 |
| `planning:update` | 计划管理 - 更新 | scope=C02 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C02 |

## C02Planner (id=6)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C02 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C02 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C02 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C02 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C02 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C02 |
| `daily_report:create` | 日报管理 - 创建 | scope=C02 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C02 |
| `daily_report:read` | 日报管理 - 查看 | scope=C02 |
| `daily_report:update` | 日报管理 - 更新 | scope=C02 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C02 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C02 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C02 |
| `planning:create` | 计划管理 - 创建 | scope=C02 |
| `planning:delete` | 计划管理 - 删除 | scope=C02 |
| `planning:read` | 计划管理 - 查看 | scope=C02 |
| `planning:update` | 计划管理 - 更新 | scope=C02 |

## C02QAQC (id=49)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C02 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C02 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C02 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C02 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C02 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C02 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C02 |
| `daily_report:read` | 日报管理 - 查看 | scope=C02 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C02 |
| `facility:read` | 主项清单管理 - 查看 | scope=C02 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C02 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C02 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C02 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C02 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C02 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C02 |
| `p6_resource:read` | 查看P6资源 | scope=C02 |
| `planning:create` | 计划管理 - 创建 | scope=C02 |
| `planning:delete` | 计划管理 - 删除 | scope=C02 |
| `planning:read` | 计划管理 - 查看 | scope=C02 |
| `planning:update` | 计划管理 - 更新 | scope=C02 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C02 |

## C05Construction (id=62)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C05 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C05 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C05 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C05 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C05 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C05 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C05 |
| `daily_report:read` | 日报管理 - 查看 | scope=C05 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C05 |
| `facility:read` | 主项清单管理 - 查看 | scope=C05 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C05 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C05 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C05 |
| `p6_resource:read` | 查看P6资源 | scope=C05 |
| `planning:create` | 计划管理 - 创建 | scope=C05 |
| `planning:delete` | 计划管理 - 删除 | scope=C05 |
| `planning:read` | 计划管理 - 查看 | scope=C05 |
| `planning:update` | 计划管理 - 更新 | scope=C05 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C05 |

## C05Planner (id=7)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C05 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C05 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C05 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C05 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C05 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C05 |
| `daily_report:create` | 日报管理 - 创建 | scope=C05 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C05 |
| `daily_report:read` | 日报管理 - 查看 | scope=C05 |
| `daily_report:update` | 日报管理 - 更新 | scope=C05 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C05 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C05 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C05 |
| `planning:create` | 计划管理 - 创建 | scope=C05 |
| `planning:delete` | 计划管理 - 删除 | scope=C05 |
| `planning:read` | 计划管理 - 查看 | scope=C05 |
| `planning:update` | 计划管理 - 更新 | scope=C05 |

## C05QAQC (id=50)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C05 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C05 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C05 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C05 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C05 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C05 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C05 |
| `daily_report:read` | 日报管理 - 查看 | scope=C05 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C05 |
| `facility:read` | 主项清单管理 - 查看 | scope=C05 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C05 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C05 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C05 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C05 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C05 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C05 |
| `p6_resource:read` | 查看P6资源 | scope=C05 |
| `planning:create` | 计划管理 - 创建 | scope=C05 |
| `planning:delete` | 计划管理 - 删除 | scope=C05 |
| `planning:read` | 计划管理 - 查看 | scope=C05 |
| `planning:update` | 计划管理 - 更新 | scope=C05 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C05 |

## C07Construction (id=63)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C07 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C07 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C07 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C07 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C07 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C07 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C07 |
| `daily_report:read` | 日报管理 - 查看 | scope=C07 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C07 |
| `facility:read` | 主项清单管理 - 查看 | scope=C07 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C07 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C07 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C07 |
| `p6_resource:read` | 查看P6资源 | scope=C07 |
| `planning:create` | 计划管理 - 创建 | scope=C07 |
| `planning:delete` | 计划管理 - 删除 | scope=C07 |
| `planning:read` | 计划管理 - 查看 | scope=C07 |
| `planning:update` | 计划管理 - 更新 | scope=C07 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C07 |

## C07Planner (id=8)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C07 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C07 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C07 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C07 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C07 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C07 |
| `daily_report:create` | 日报管理 - 创建 | scope=C07 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C07 |
| `daily_report:read` | 日报管理 - 查看 | scope=C07 |
| `daily_report:update` | 日报管理 - 更新 | scope=C07 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C07 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C07 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C07 |
| `planning:create` | 计划管理 - 创建 | scope=C07 |
| `planning:delete` | 计划管理 - 删除 | scope=C07 |
| `planning:read` | 计划管理 - 查看 | scope=C07 |
| `planning:update` | 计划管理 - 更新 | scope=C07 |

## C07QAQC (id=51)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C07 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C07 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C07 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C07 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C07 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C07 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C07 |
| `daily_report:read` | 日报管理 - 查看 | scope=C07 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C07 |
| `facility:read` | 主项清单管理 - 查看 | scope=C07 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C07 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C07 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C07 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C07 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C07 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C07 |
| `p6_resource:read` | 查看P6资源 | scope=C07 |
| `planning:create` | 计划管理 - 创建 | scope=C07 |
| `planning:delete` | 计划管理 - 删除 | scope=C07 |
| `planning:read` | 计划管理 - 查看 | scope=C07 |
| `planning:update` | 计划管理 - 更新 | scope=C07 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C07 |

## C09Construction (id=64)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C09 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C09 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C09 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C09 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C09 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C09 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C09 |
| `daily_report:read` | 日报管理 - 查看 | scope=C09 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C09 |
| `facility:read` | 主项清单管理 - 查看 | scope=C09 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C09 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C09 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C09 |
| `p6_resource:read` | 查看P6资源 | scope=C09 |
| `planning:create` | 计划管理 - 创建 | scope=C09 |
| `planning:delete` | 计划管理 - 删除 | scope=C09 |
| `planning:read` | 计划管理 - 查看 | scope=C09 |
| `planning:update` | 计划管理 - 更新 | scope=C09 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C09 |

## C09Planner (id=9)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C09 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C09 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C09 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C09 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C09 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C09 |
| `daily_report:create` | 日报管理 - 创建 | scope=C09 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C09 |
| `daily_report:read` | 日报管理 - 查看 | scope=C09 |
| `daily_report:update` | 日报管理 - 更新 | scope=C09 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C09 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C09 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C09 |
| `planning:create` | 计划管理 - 创建 | scope=C09 |
| `planning:delete` | 计划管理 - 删除 | scope=C09 |
| `planning:read` | 计划管理 - 查看 | scope=C09 |
| `planning:update` | 计划管理 - 更新 | scope=C09 |

## C09QAQC (id=52)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C09 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C09 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C09 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C09 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C09 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C09 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C09 |
| `daily_report:read` | 日报管理 - 查看 | scope=C09 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C09 |
| `facility:read` | 主项清单管理 - 查看 | scope=C09 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C09 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C09 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C09 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C09 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C09 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C09 |
| `p6_resource:read` | 查看P6资源 | scope=C09 |
| `planning:create` | 计划管理 - 创建 | scope=C09 |
| `planning:delete` | 计划管理 - 删除 | scope=C09 |
| `planning:read` | 计划管理 - 查看 | scope=C09 |
| `planning:update` | 计划管理 - 更新 | scope=C09 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C09 |

## C12Construction (id=65)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C12 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C12 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C12 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C12 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C12 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C12 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C12 |
| `daily_report:read` | 日报管理 - 查看 | scope=C12 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C12 |
| `facility:read` | 主项清单管理 - 查看 | scope=C12 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C12 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C12 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C12 |
| `p6_resource:read` | 查看P6资源 | scope=C12 |
| `planning:create` | 计划管理 - 创建 | scope=C12 |
| `planning:delete` | 计划管理 - 删除 | scope=C12 |
| `planning:read` | 计划管理 - 查看 | scope=C12 |
| `planning:update` | 计划管理 - 更新 | scope=C12 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C12 |

## C12Planner (id=10)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C12 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C12 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C12 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C12 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C12 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C12 |
| `daily_report:create` | 日报管理 - 创建 | scope=C12 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C12 |
| `daily_report:read` | 日报管理 - 查看 | scope=C12 |
| `daily_report:update` | 日报管理 - 更新 | scope=C12 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C12 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C12 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C12 |
| `planning:create` | 计划管理 - 创建 | scope=C12 |
| `planning:delete` | 计划管理 - 删除 | scope=C12 |
| `planning:read` | 计划管理 - 查看 | scope=C12 |
| `planning:update` | 计划管理 - 更新 | scope=C12 |

## C12QAQC (id=53)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C12 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C12 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C12 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C12 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C12 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C12 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C12 |
| `daily_report:read` | 日报管理 - 查看 | scope=C12 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C12 |
| `facility:read` | 主项清单管理 - 查看 | scope=C12 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C12 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C12 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C12 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C12 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C12 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C12 |
| `p6_resource:read` | 查看P6资源 | scope=C12 |
| `planning:create` | 计划管理 - 创建 | scope=C12 |
| `planning:delete` | 计划管理 - 删除 | scope=C12 |
| `planning:read` | 计划管理 - 查看 | scope=C12 |
| `planning:update` | 计划管理 - 更新 | scope=C12 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C12 |

## C13Construction (id=66)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C13 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C13 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C13 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C13 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C13 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C13 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C13 |
| `daily_report:read` | 日报管理 - 查看 | scope=C13 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C13 |
| `facility:read` | 主项清单管理 - 查看 | scope=C13 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C13 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C13 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C13 |
| `p6_resource:read` | 查看P6资源 | scope=C13 |
| `planning:create` | 计划管理 - 创建 | scope=C13 |
| `planning:delete` | 计划管理 - 删除 | scope=C13 |
| `planning:read` | 计划管理 - 查看 | scope=C13 |
| `planning:update` | 计划管理 - 更新 | scope=C13 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C13 |

## C13Planner (id=11)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C13 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C13 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C13 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C13 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C13 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C13 |
| `daily_report:create` | 日报管理 - 创建 | scope=C13 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C13 |
| `daily_report:read` | 日报管理 - 查看 | scope=C13 |
| `daily_report:update` | 日报管理 - 更新 | scope=C13 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C13 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C13 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C13 |
| `planning:create` | 计划管理 - 创建 | scope=C13 |
| `planning:delete` | 计划管理 - 删除 | scope=C13 |
| `planning:read` | 计划管理 - 查看 | scope=C13 |
| `planning:update` | 计划管理 - 更新 | scope=C13 |

## C13QAQC (id=54)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C13 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C13 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C13 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C13 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C13 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C13 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C13 |
| `daily_report:read` | 日报管理 - 查看 | scope=C13 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C13 |
| `facility:read` | 主项清单管理 - 查看 | scope=C13 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C13 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C13 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C13 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C13 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C13 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C13 |
| `p6_resource:read` | 查看P6资源 | scope=C13 |
| `planning:create` | 计划管理 - 创建 | scope=C13 |
| `planning:delete` | 计划管理 - 删除 | scope=C13 |
| `planning:read` | 计划管理 - 查看 | scope=C13 |
| `planning:update` | 计划管理 - 更新 | scope=C13 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C13 |

## C15Construction (id=67)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C15 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C15 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C15 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C15 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C15 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C15 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C15 |
| `daily_report:read` | 日报管理 - 查看 | scope=C15 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C15 |
| `facility:read` | 主项清单管理 - 查看 | scope=C15 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C15 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C15 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C15 |
| `p6_resource:read` | 查看P6资源 | scope=C15 |
| `planning:create` | 计划管理 - 创建 | scope=C15 |
| `planning:delete` | 计划管理 - 删除 | scope=C15 |
| `planning:read` | 计划管理 - 查看 | scope=C15 |
| `planning:update` | 计划管理 - 更新 | scope=C15 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C15 |

## C15Planner (id=12)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C15 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C15 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C15 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C15 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C15 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C15 |
| `daily_report:create` | 日报管理 - 创建 | scope=C15 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C15 |
| `daily_report:read` | 日报管理 - 查看 | scope=C15 |
| `daily_report:update` | 日报管理 - 更新 | scope=C15 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C15 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C15 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C15 |
| `planning:create` | 计划管理 - 创建 | scope=C15 |
| `planning:delete` | 计划管理 - 删除 | scope=C15 |
| `planning:read` | 计划管理 - 查看 | scope=C15 |
| `planning:update` | 计划管理 - 更新 | scope=C15 |

## C15QAQC (id=55)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C15 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C15 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C15 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C15 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C15 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C15 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C15 |
| `daily_report:read` | 日报管理 - 查看 | scope=C15 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C15 |
| `facility:read` | 主项清单管理 - 查看 | scope=C15 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C15 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C15 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C15 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C15 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C15 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C15 |
| `p6_resource:read` | 查看P6资源 | scope=C15 |
| `planning:create` | 计划管理 - 创建 | scope=C15 |
| `planning:delete` | 计划管理 - 删除 | scope=C15 |
| `planning:read` | 计划管理 - 查看 | scope=C15 |
| `planning:update` | 计划管理 - 更新 | scope=C15 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C15 |

## C16Construction (id=68)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C16 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C16 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C16 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C16 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C16 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C16 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C16 |
| `daily_report:read` | 日报管理 - 查看 | scope=C16 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C16 |
| `facility:read` | 主项清单管理 - 查看 | scope=C16 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C16 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C16 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C16 |
| `p6_resource:read` | 查看P6资源 | scope=C16 |
| `planning:create` | 计划管理 - 创建 | scope=C16 |
| `planning:delete` | 计划管理 - 删除 | scope=C16 |
| `planning:read` | 计划管理 - 查看 | scope=C16 |
| `planning:update` | 计划管理 - 更新 | scope=C16 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C16 |

## C16Planner (id=13)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C16 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C16 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C16 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C16 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C16 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C16 |
| `daily_report:create` | 日报管理 - 创建 | scope=C16 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C16 |
| `daily_report:read` | 日报管理 - 查看 | scope=C16 |
| `daily_report:update` | 日报管理 - 更新 | scope=C16 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C16 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C16 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C16 |
| `planning:create` | 计划管理 - 创建 | scope=C16 |
| `planning:delete` | 计划管理 - 删除 | scope=C16 |
| `planning:read` | 计划管理 - 查看 | scope=C16 |
| `planning:update` | 计划管理 - 更新 | scope=C16 |

## C16QAQC (id=56)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C16 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C16 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C16 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C16 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C16 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C16 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C16 |
| `daily_report:read` | 日报管理 - 查看 | scope=C16 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C16 |
| `facility:read` | 主项清单管理 - 查看 | scope=C16 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C16 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C16 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C16 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C16 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C16 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C16 |
| `p6_resource:read` | 查看P6资源 | scope=C16 |
| `planning:create` | 计划管理 - 创建 | scope=C16 |
| `planning:delete` | 计划管理 - 删除 | scope=C16 |
| `planning:read` | 计划管理 - 查看 | scope=C16 |
| `planning:update` | 计划管理 - 更新 | scope=C16 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C16 |

## C17Construction (id=69)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C17 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C17 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C17 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C17 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C17 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C17 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C17 |
| `daily_report:read` | 日报管理 - 查看 | scope=C17 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C17 |
| `facility:read` | 主项清单管理 - 查看 | scope=C17 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C17 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C17 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C17 |
| `p6_resource:read` | 查看P6资源 | scope=C17 |
| `planning:create` | 计划管理 - 创建 | scope=C17 |
| `planning:delete` | 计划管理 - 删除 | scope=C17 |
| `planning:read` | 计划管理 - 查看 | scope=C17 |
| `planning:update` | 计划管理 - 更新 | scope=C17 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C17 |

## C17Planner (id=14)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C17 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C17 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C17 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C17 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C17 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C17 |
| `daily_report:create` | 日报管理 - 创建 | scope=C17 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C17 |
| `daily_report:read` | 日报管理 - 查看 | scope=C17 |
| `daily_report:update` | 日报管理 - 更新 | scope=C17 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C17 |
| `facility:read` | 主项清单管理 - 查看 | scope=C17 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C17 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C17 |
| `planning:create` | 计划管理 - 创建 | scope=C17 |
| `planning:delete` | 计划管理 - 删除 | scope=C17 |
| `planning:read` | 计划管理 - 查看 | scope=C17 |
| `planning:update` | 计划管理 - 更新 | scope=C17 |

## C17QAQC (id=57)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C17 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C17 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C17 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C17 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C17 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C17 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C17 |
| `daily_report:read` | 日报管理 - 查看 | scope=C17 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C17 |
| `facility:read` | 主项清单管理 - 查看 | scope=C17 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C17 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C17 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C17 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C17 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C17 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C17 |
| `p6_resource:read` | 查看P6资源 | scope=C17 |
| `planning:create` | 计划管理 - 创建 | scope=C17 |
| `planning:delete` | 计划管理 - 删除 | scope=C17 |
| `planning:read` | 计划管理 - 查看 | scope=C17 |
| `planning:update` | 计划管理 - 更新 | scope=C17 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C17 |

## C18Construction (id=70)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C18 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C18 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C18 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C18 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C18 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C18 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C18 |
| `daily_report:read` | 日报管理 - 查看 | scope=C18 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C18 |
| `facility:read` | 主项清单管理 - 查看 | scope=C18 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C18 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C18 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C18 |
| `p6_resource:read` | 查看P6资源 | scope=C18 |
| `planning:create` | 计划管理 - 创建 | scope=C18 |
| `planning:delete` | 计划管理 - 删除 | scope=C18 |
| `planning:read` | 计划管理 - 查看 | scope=C18 |
| `planning:update` | 计划管理 - 更新 | scope=C18 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C18 |

## C18Planner (id=15)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C18 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C18 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C18 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C18 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C18 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C18 |
| `daily_report:create` | 日报管理 - 创建 | scope=C18 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C18 |
| `daily_report:read` | 日报管理 - 查看 | scope=C18 |
| `daily_report:update` | 日报管理 - 更新 | scope=C18 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C18 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C18 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C18 |
| `planning:create` | 计划管理 - 创建 | scope=C18 |
| `planning:delete` | 计划管理 - 删除 | scope=C18 |
| `planning:read` | 计划管理 - 查看 | scope=C18 |
| `planning:update` | 计划管理 - 更新 | scope=C18 |

## C18QAQC (id=58)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C18 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C18 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C18 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C18 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C18 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C18 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C18 |
| `daily_report:read` | 日报管理 - 查看 | scope=C18 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C18 |
| `facility:read` | 主项清单管理 - 查看 | scope=C18 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C18 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C18 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C18 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C18 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C18 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C18 |
| `p6_resource:read` | 查看P6资源 | scope=C18 |
| `planning:create` | 计划管理 - 创建 | scope=C18 |
| `planning:delete` | 计划管理 - 删除 | scope=C18 |
| `planning:read` | 计划管理 - 查看 | scope=C18 |
| `planning:update` | 计划管理 - 更新 | scope=C18 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C18 |

## C19Construction (id=71)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C19 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C19 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C19 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C19 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C19 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C19 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C19 |
| `daily_report:read` | 日报管理 - 查看 | scope=C19 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C19 |
| `facility:read` | 主项清单管理 - 查看 | scope=C19 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C19 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C19 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C19 |
| `p6_resource:read` | 查看P6资源 | scope=C19 |
| `planning:create` | 计划管理 - 创建 | scope=C19 |
| `planning:delete` | 计划管理 - 删除 | scope=C19 |
| `planning:read` | 计划管理 - 查看 | scope=C19 |
| `planning:update` | 计划管理 - 更新 | scope=C19 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C19 |

## C19Planner (id=16)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C19 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C19 |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C19 |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C19 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C19 |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C19 |
| `daily_report:create` | 日报管理 - 创建 | scope=C19 |
| `daily_report:delete` | 日报管理 - 删除 | scope=C19 |
| `daily_report:read` | 日报管理 - 查看 | scope=C19 |
| `daily_report:update` | 日报管理 - 更新 | scope=C19 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C19 |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C19 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C19 |
| `planning:create` | 计划管理 - 创建 | scope=C19 |
| `planning:delete` | 计划管理 - 删除 | scope=C19 |
| `planning:read` | 计划管理 - 查看 | scope=C19 |
| `planning:update` | 计划管理 - 更新 | scope=C19 |

## C19QAQC (id=59)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C19 |
| `acceptance_procedure:read` | 验收程序 - 查看 | scope=C19 |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | scope=C19 |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | scope=C19 |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C19 |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | scope=C19 |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C19 |
| `daily_report:read` | 日报管理 - 查看 | scope=C19 |
| `exhibition_report:read` | 展报管理 - 查看 | scope=C19 |
| `facility:read` | 主项清单管理 - 查看 | scope=C19 |
| `inspection_db:create` | 验收日报 - 创建 | scope=C19 |
| `inspection_db:delete` | 验收日报 - 删除 | scope=C19 |
| `inspection_db:read` | 验收日报 - 查看 | scope=C19 |
| `inspection_db:update` | 验收日报 - 更新 | scope=C19 |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C19 |
| `p6_database:read` | P6数据库管理 - 查看 | scope=C19 |
| `p6_resource:read` | 查看P6资源 | scope=C19 |
| `planning:create` | 计划管理 - 创建 | scope=C19 |
| `planning:delete` | 计划管理 - 删除 | scope=C19 |
| `planning:read` | 计划管理 - 查看 | scope=C19 |
| `planning:update` | 计划管理 - 更新 | scope=C19 |
| `welding_data:read` | 焊接数据管理 - 查看 | scope=C19 |

## CommonUser (id=78)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| `daily_report:read` | 日报管理 - 查看 | （全范围） |
| `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `inspection_db:read` | 验收日报 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| `planning:create` | 计划管理 - 创建 | （全范围） |
| `planning:delete` | 计划管理 - 删除 | （全范围） |
| `planning:read` | 计划管理 - 查看 | （全范围） |
| `planning:update` | 计划管理 - 更新 | （全范围） |

## ECUConstructionSupervisor (id=75)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=ECU |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=ECU |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=ECU |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | subproject=ECU |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | subproject=ECU |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=ECU |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | subproject=ECU |
| `daily_report:read` | 日报管理 - 查看 | subproject=ECU |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=ECU |
| `facility:read` | 主项清单管理 - 查看 | subproject=ECU |
| `inspection_db:read` | 验收日报 - 查看 | subproject=ECU |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=ECU |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=ECU |
| `p6_resource:read` | 查看P6资源 | subproject=ECU |
| `planning:create` | 计划管理 - 创建 | subproject=ECU |
| `planning:delete` | 计划管理 - 删除 | subproject=ECU |
| `planning:read` | 计划管理 - 查看 | subproject=ECU |
| `planning:update` | 计划管理 - 更新 | subproject=ECU |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=ECU |

## ECUQAQCSupervisor (id=72)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=ECU |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=ECU |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | subproject=ECU |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | subproject=ECU |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=ECU |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | subproject=ECU |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=ECU |
| `daily_report:read` | 日报管理 - 查看 | subproject=ECU |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=ECU |
| `facility:read` | 主项清单管理 - 查看 | subproject=ECU |
| `inspection_db:create` | 验收日报 - 创建 | subproject=ECU |
| `inspection_db:delete` | 验收日报 - 删除 | subproject=ECU |
| `inspection_db:read` | 验收日报 - 查看 | subproject=ECU |
| `inspection_db:update` | 验收日报 - 更新 | subproject=ECU |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=ECU |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=ECU |
| `p6_resource:read` | 查看P6资源 | subproject=ECU |
| `planning:create` | 计划管理 - 创建 | subproject=ECU |
| `planning:delete` | 计划管理 - 删除 | subproject=ECU |
| `planning:read` | 计划管理 - 查看 | subproject=ECU |
| `planning:update` | 计划管理 - 更新 | subproject=ECU |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=ECU |

## Guest (id=17)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| `daily_report:read` | 日报管理 - 查看 | （全范围） |
| `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `inspection_db:read` | 验收日报 - 查看 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| `planning:create` | 计划管理 - 创建 | （全范围） |
| `planning:delete` | 计划管理 - 删除 | （全范围） |
| `planning:read` | 计划管理 - 查看 | （全范围） |
| `planning:update` | 计划管理 - 更新 | （全范围） |
| `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |

## PELConstructionSupervisor (id=76)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=PEL |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=PEL |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=PEL |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | subproject=PEL |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | subproject=PEL |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=PEL |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | subproject=PEL |
| `daily_report:read` | 日报管理 - 查看 | subproject=PEL |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=PEL |
| `facility:read` | 主项清单管理 - 查看 | subproject=PEL |
| `inspection_db:read` | 验收日报 - 查看 | subproject=PEL |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=PEL |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=PEL |
| `p6_resource:read` | 查看P6资源 | subproject=PEL |
| `planning:create` | 计划管理 - 创建 | subproject=PEL |
| `planning:delete` | 计划管理 - 删除 | subproject=PEL |
| `planning:read` | 计划管理 - 查看 | subproject=PEL |
| `planning:update` | 计划管理 - 更新 | subproject=PEL |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=PEL |

## PELQAQCSupervisor (id=73)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=PEL |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=PEL |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | subproject=PEL |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | subproject=PEL |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=PEL |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | subproject=PEL |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=PEL |
| `daily_report:read` | 日报管理 - 查看 | subproject=PEL |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=PEL |
| `facility:read` | 主项清单管理 - 查看 | subproject=PEL |
| `inspection_db:create` | 验收日报 - 创建 | subproject=PEL |
| `inspection_db:delete` | 验收日报 - 删除 | subproject=PEL |
| `inspection_db:read` | 验收日报 - 查看 | subproject=PEL |
| `inspection_db:update` | 验收日报 - 更新 | subproject=PEL |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=PEL |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=PEL |
| `p6_resource:read` | 查看P6资源 | subproject=PEL |
| `planning:create` | 计划管理 - 创建 | subproject=PEL |
| `planning:delete` | 计划管理 - 删除 | subproject=PEL |
| `planning:read` | 计划管理 - 查看 | subproject=PEL |
| `planning:update` | 计划管理 - 更新 | subproject=PEL |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=PEL |

## UIOConstructionSupervisor (id=77)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=UIO |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=UIO |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=UIO |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | subproject=UIO |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | subproject=UIO |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=UIO |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | subproject=UIO |
| `daily_report:read` | 日报管理 - 查看 | subproject=UIO |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=UIO |
| `facility:read` | 主项清单管理 - 查看 | subproject=UIO |
| `inspection_db:read` | 验收日报 - 查看 | subproject=UIO |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=UIO |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=UIO |
| `p6_resource:read` | 查看P6资源 | subproject=UIO |
| `planning:create` | 计划管理 - 创建 | subproject=UIO |
| `planning:delete` | 计划管理 - 删除 | subproject=UIO |
| `planning:read` | 计划管理 - 查看 | subproject=UIO |
| `planning:update` | 计划管理 - 更新 | subproject=UIO |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=UIO |

## UIOQAQCSupervisor (id=74)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:read` | ABD工程量信息管理 - 查看 | subproject=UIO |
| `acceptance_procedure:read` | 验收程序 - 查看 | subproject=UIO |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | subproject=UIO |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | subproject=UIO |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | subproject=UIO |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | subproject=UIO |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | subproject=UIO |
| `daily_report:read` | 日报管理 - 查看 | subproject=UIO |
| `exhibition_report:read` | 展报管理 - 查看 | subproject=UIO |
| `facility:read` | 主项清单管理 - 查看 | subproject=UIO |
| `inspection_db:create` | 验收日报 - 创建 | subproject=UIO |
| `inspection_db:delete` | 验收日报 - 删除 | subproject=UIO |
| `inspection_db:read` | 验收日报 - 查看 | subproject=UIO |
| `inspection_db:update` | 验收日报 - 更新 | subproject=UIO |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | subproject=UIO |
| `p6_database:read` | P6数据库管理 - 查看 | subproject=UIO |
| `p6_resource:read` | 查看P6资源 | subproject=UIO |
| `planning:create` | 计划管理 - 创建 | subproject=UIO |
| `planning:delete` | 计划管理 - 删除 | subproject=UIO |
| `planning:read` | 计划管理 - 查看 | subproject=UIO |
| `planning:update` | 计划管理 - 更新 | subproject=UIO |
| `welding_data:read` | 焊接数据管理 - 查看 | subproject=UIO |

## 系统管理员 (id=3)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| `daily_report:create` | 日报管理 - 创建 | （全范围） |
| `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| `daily_report:read` | 日报管理 - 查看 | （全范围） |
| `daily_report:update` | 日报管理 - 更新 | （全范围） |
| `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| `facility:create` | 主项清单管理 - 创建 | （全范围） |
| `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `facility:update` | 主项清单管理 - 更新 | （全范围） |
| `inspection_db:create` | 验收日报 - 创建 | （全范围） |
| `inspection_db:delete` | 验收日报 - 删除 | （全范围） |
| `inspection_db:read` | 验收日报 - 查看 | （全范围） |
| `inspection_db:update` | 验收日报 - 更新 | （全范围） |
| `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| `p6_sync:delete` | P6同步管理 - 删除 | （全范围） |
| `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| `p6_sync:sync` | P6同步管理 - 执行同步 | （全范围） |
| `p6_sync:update` | P6同步管理 - 更新 | （全范围） |
| `permission:assign` | 权限管理 - 分配 | （全范围） |
| `permission:read` | 权限管理 - 查看 | （全范围） |
| `permission:revoke` | 权限管理 - 撤销 | （全范围） |
| `planning:create` | 计划管理 - 创建 | （全范围） |
| `planning:delete` | 计划管理 - 删除 | （全范围） |
| `planning:read` | 计划管理 - 查看 | （全范围） |
| `planning:update` | 计划管理 - 更新 | （全范围） |
| `user:create` | 用户管理 - 创建 | （全范围） |
| `user:delete` | 用户管理 - 删除 | （全范围） |
| `user:read` | 用户管理 - 查看 | （全范围） |
| `user:update` | 用户管理 - 更新 | （全范围） |
| `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |
| `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| `welding_data:sync` | 焊接数据 - 同步 | （全范围） |

## 计划主管 (id=5)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| `daily_report:create` | 日报管理 - 创建 | （全范围） |
| `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| `daily_report:read` | 日报管理 - 查看 | （全范围） |
| `daily_report:update` | 日报管理 - 更新 | （全范围） |
| `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| `facility:create` | 主项清单管理 - 创建 | （全范围） |
| `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `facility:update` | 主项清单管理 - 更新 | （全范围） |
| `inspection_db:read` | 验收日报 - 查看 | （全范围） |
| `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| `planning:create` | 计划管理 - 创建 | （全范围） |
| `planning:delete` | 计划管理 - 删除 | （全范围） |
| `planning:read` | 计划管理 - 查看 | （全范围） |
| `planning:update` | 计划管理 - 更新 | （全范围） |
| `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |
| `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |

## 计划经理 (id=2)

| 权限代码 | 权限名称 | 范围 |
|----------|----------|------|
| `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| `acceptance_procedure:read` | 验收程序 - 查看 | （全范围） |
| `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| `daily_report:create` | 日报管理 - 创建 | （全范围） |
| `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| `daily_report:read` | 日报管理 - 查看 | （全范围） |
| `daily_report:update` | 日报管理 - 更新 | （全范围） |
| `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| `facility:create` | 主项清单管理 - 创建 | （全范围） |
| `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| `facility:read` | 主项清单管理 - 查看 | （全范围） |
| `facility:update` | 主项清单管理 - 更新 | （全范围） |
| `inspection_db:create` | 验收日报 - 创建 | （全范围） |
| `inspection_db:delete` | 验收日报 - 删除 | （全范围） |
| `inspection_db:read` | 验收日报 - 查看 | （全范围） |
| `inspection_db:update` | 验收日报 - 更新 | （全范围） |
| `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| `planning:create` | 计划管理 - 创建 | （全范围） |
| `planning:delete` | 计划管理 - 删除 | （全范围） |
| `planning:read` | 计划管理 - 查看 | （全范围） |
| `planning:update` | 计划管理 - 更新 | （全范围） |
| `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |
| `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
