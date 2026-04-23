# 账号权限一览

本文档由 `backend/scripts/list_user_permissions.py --md` 生成，列出各账号拥有的权限及 scope 范围限制。

**生成时间**：2026-02-12 11:35

---

## admin (id=1) [超级管理员]

拥有所有权限（不展开）。

## C01Planner (id=25)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C01Planner | `planning:read` | 计划管理 - 查看 | scope=C01 |
| 角色:C01Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C01 |
| 角色:C01Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C01 |
| 角色:C01Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C01 |
| 角色:C01Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C01 |
| 角色:C01Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `daily_report:read` | 日报管理 - 查看 | scope=C01 |
| 角色:C01Planner | `daily_report:create` | 日报管理 - 创建 | scope=C01 |
| 角色:C01Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C01 |
| 角色:C01Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:C01Planner | `planning:update` | 计划管理 - 更新 | scope=C01 |
| 角色:C01Planner | `daily_report:update` | 日报管理 - 更新 | scope=C01 |
| 角色:C01Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C01 |

## C02Planner (id=26)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C02Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C02 |
| 角色:C02Planner | `planning:read` | 计划管理 - 查看 | scope=C02 |
| 角色:C02Planner | `planning:update` | 计划管理 - 更新 | scope=C02 |
| 角色:C02Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C02 |
| 角色:C02Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C02 |
| 角色:C02Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C02 |
| 角色:C02Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C02 |
| 角色:C02Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C02 |
| 角色:C02Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C02 |
| 角色:C02Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C02 |
| 角色:C02Planner | `daily_report:read` | 日报管理 - 查看 | scope=C02 |
| 角色:C02Planner | `daily_report:create` | 日报管理 - 创建 | scope=C02 |
| 角色:C02Planner | `daily_report:update` | 日报管理 - 更新 | scope=C02 |
| 角色:C02Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C02 |
| 角色:C02Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C02 |
| 角色:C02Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C05Planner (id=27)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C05Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C05 |
| 角色:C05Planner | `planning:read` | 计划管理 - 查看 | scope=C05 |
| 角色:C05Planner | `planning:update` | 计划管理 - 更新 | scope=C05 |
| 角色:C05Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C05 |
| 角色:C05Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C05 |
| 角色:C05Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C05 |
| 角色:C05Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C05 |
| 角色:C05Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C05 |
| 角色:C05Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C05 |
| 角色:C05Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C05 |
| 角色:C05Planner | `daily_report:read` | 日报管理 - 查看 | scope=C05 |
| 角色:C05Planner | `daily_report:update` | 日报管理 - 更新 | scope=C05 |
| 角色:C05Planner | `daily_report:create` | 日报管理 - 创建 | scope=C05 |
| 角色:C05Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C05 |
| 角色:C05Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C05 |
| 角色:C05Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C07Planner (id=28)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C07Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C07 |
| 角色:C07Planner | `planning:read` | 计划管理 - 查看 | scope=C07 |
| 角色:C07Planner | `planning:update` | 计划管理 - 更新 | scope=C07 |
| 角色:C07Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C07 |
| 角色:C07Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C07 |
| 角色:C07Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C07 |
| 角色:C07Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C07 |
| 角色:C07Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C07 |
| 角色:C07Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C07 |
| 角色:C07Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C07 |
| 角色:C07Planner | `daily_report:read` | 日报管理 - 查看 | scope=C07 |
| 角色:C07Planner | `daily_report:create` | 日报管理 - 创建 | scope=C07 |
| 角色:C07Planner | `daily_report:update` | 日报管理 - 更新 | scope=C07 |
| 角色:C07Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C07 |
| 角色:C07Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C07 |
| 角色:C07Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C09Planner (id=29)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C09Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C09 |
| 角色:C09Planner | `planning:read` | 计划管理 - 查看 | scope=C09 |
| 角色:C09Planner | `planning:update` | 计划管理 - 更新 | scope=C09 |
| 角色:C09Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C09 |
| 角色:C09Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C09 |
| 角色:C09Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C09 |
| 角色:C09Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C09 |
| 角色:C09Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C09 |
| 角色:C09Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C09 |
| 角色:C09Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C09 |
| 角色:C09Planner | `daily_report:read` | 日报管理 - 查看 | scope=C09 |
| 角色:C09Planner | `daily_report:create` | 日报管理 - 创建 | scope=C09 |
| 角色:C09Planner | `daily_report:update` | 日报管理 - 更新 | scope=C09 |
| 角色:C09Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C09 |
| 角色:C09Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C09 |
| 角色:C09Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C12Planner (id=30)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C12Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C12 |
| 角色:C12Planner | `planning:read` | 计划管理 - 查看 | scope=C12 |
| 角色:C12Planner | `planning:update` | 计划管理 - 更新 | scope=C12 |
| 角色:C12Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C12 |
| 角色:C12Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C12 |
| 角色:C12Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C12 |
| 角色:C12Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C12 |
| 角色:C12Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C12 |
| 角色:C12Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C12 |
| 角色:C12Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C12 |
| 角色:C12Planner | `daily_report:read` | 日报管理 - 查看 | scope=C12 |
| 角色:C12Planner | `daily_report:create` | 日报管理 - 创建 | scope=C12 |
| 角色:C12Planner | `daily_report:update` | 日报管理 - 更新 | scope=C12 |
| 角色:C12Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C12 |
| 角色:C12Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C12 |
| 角色:C12Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C13Planner (id=31)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C13Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C13 |
| 角色:C13Planner | `planning:read` | 计划管理 - 查看 | scope=C13 |
| 角色:C13Planner | `planning:update` | 计划管理 - 更新 | scope=C13 |
| 角色:C13Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C13 |
| 角色:C13Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C13 |
| 角色:C13Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C13 |
| 角色:C13Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C13 |
| 角色:C13Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C13 |
| 角色:C13Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C13 |
| 角色:C13Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C13 |
| 角色:C13Planner | `daily_report:read` | 日报管理 - 查看 | scope=C13 |
| 角色:C13Planner | `daily_report:create` | 日报管理 - 创建 | scope=C13 |
| 角色:C13Planner | `daily_report:update` | 日报管理 - 更新 | scope=C13 |
| 角色:C13Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C13 |
| 角色:C13Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C13 |
| 角色:C13Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C15Planner (id=32)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C15Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C15 |
| 角色:C15Planner | `planning:read` | 计划管理 - 查看 | scope=C15 |
| 角色:C15Planner | `planning:update` | 计划管理 - 更新 | scope=C15 |
| 角色:C15Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C15 |
| 角色:C15Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C15 |
| 角色:C15Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C15 |
| 角色:C15Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C15 |
| 角色:C15Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C15 |
| 角色:C15Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C15 |
| 角色:C15Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C15 |
| 角色:C15Planner | `daily_report:read` | 日报管理 - 查看 | scope=C15 |
| 角色:C15Planner | `daily_report:create` | 日报管理 - 创建 | scope=C15 |
| 角色:C15Planner | `daily_report:update` | 日报管理 - 更新 | scope=C15 |
| 角色:C15Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C15 |
| 角色:C15Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C15 |
| 角色:C15Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C16Planner (id=33)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C16Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C16 |
| 角色:C16Planner | `planning:read` | 计划管理 - 查看 | scope=C16 |
| 角色:C16Planner | `planning:update` | 计划管理 - 更新 | scope=C16 |
| 角色:C16Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C16 |
| 角色:C16Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C16 |
| 角色:C16Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C16 |
| 角色:C16Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C16 |
| 角色:C16Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C16 |
| 角色:C16Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C16 |
| 角色:C16Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C16 |
| 角色:C16Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C16 |
| 角色:C16Planner | `daily_report:read` | 日报管理 - 查看 | scope=C16 |
| 角色:C16Planner | `daily_report:create` | 日报管理 - 创建 | scope=C16 |
| 角色:C16Planner | `daily_report:update` | 日报管理 - 更新 | scope=C16 |
| 角色:C16Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C16 |
| 角色:C16Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C17Planner (id=34)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C17Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C17 |
| 角色:C17Planner | `planning:read` | 计划管理 - 查看 | scope=C17 |
| 角色:C17Planner | `planning:update` | 计划管理 - 更新 | scope=C17 |
| 角色:C17Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C17 |
| 角色:C17Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C17 |
| 角色:C17Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C17 |
| 角色:C17Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C17 |
| 角色:C17Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C17 |
| 角色:C17Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C17 |
| 角色:C17Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C17 |
| 角色:C17Planner | `daily_report:read` | 日报管理 - 查看 | scope=C17 |
| 角色:C17Planner | `daily_report:create` | 日报管理 - 创建 | scope=C17 |
| 角色:C17Planner | `daily_report:update` | 日报管理 - 更新 | scope=C17 |
| 角色:C17Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C17 |
| 角色:C17Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C17 |
| 角色:C17Planner | `facility:read` | 主项清单管理 - 查看 | scope=C17 |

## C18Planner (id=35)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C18Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C18 |
| 角色:C18Planner | `planning:read` | 计划管理 - 查看 | scope=C18 |
| 角色:C18Planner | `planning:update` | 计划管理 - 更新 | scope=C18 |
| 角色:C18Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C18 |
| 角色:C18Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C18 |
| 角色:C18Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C18 |
| 角色:C18Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C18 |
| 角色:C18Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C18 |
| 角色:C18Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C18 |
| 角色:C18Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C18 |
| 角色:C18Planner | `daily_report:read` | 日报管理 - 查看 | scope=C18 |
| 角色:C18Planner | `daily_report:create` | 日报管理 - 创建 | scope=C18 |
| 角色:C18Planner | `daily_report:update` | 日报管理 - 更新 | scope=C18 |
| 角色:C18Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C18 |
| 角色:C18Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C18 |
| 角色:C18Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |

## C19Planner (id=36)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C19Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C19 |
| 角色:C19Planner | `planning:read` | 计划管理 - 查看 | scope=C19 |
| 角色:C19Planner | `planning:update` | 计划管理 - 更新 | scope=C19 |
| 角色:C19Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C19 |
| 角色:C19Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C19 |
| 角色:C19Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C19 |
| 角色:C19Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C19 |
| 角色:C19Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C19 |
| 角色:C19Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C19 |
| 角色:C19Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C19 |
| 角色:C19Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C19 |
| 角色:C19Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:C19Planner | `daily_report:read` | 日报管理 - 查看 | scope=C19 |
| 角色:C19Planner | `daily_report:create` | 日报管理 - 创建 | scope=C19 |
| 角色:C19Planner | `daily_report:update` | 日报管理 - 更新 | scope=C19 |
| 角色:C19Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C19 |

## chenqiang (id=15)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## feihongzhi (id=8)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## GuestFullModule (id=39)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:Guest | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:Guest | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:Guest | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:Guest | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:Guest | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:Guest | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:Guest | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:Guest | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:Guest | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:Guest | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:Guest | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |

## jiangxiaojuan (id=6)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## liangjie (id=9)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## liguobiao (id=38)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## lihuichuan (id=37)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## liyuansen (id=20)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## mengguanglan (id=10)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## qinyuhan (id=7)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## qinzuzhao (id=14)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## sunlin (id=16)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## tangjian (id=4)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## tangrui (id=13)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## tangzikai (id=22)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## test01 (id=3)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:C01Planner | `planning:read` | 计划管理 - 查看 | scope=C01 |
| 角色:C01Planner | `construction_volume:read` | 施工工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `construction_volume:create` | 施工工程量信息管理 - 创建 | scope=C01 |
| 角色:C01Planner | `construction_volume:update` | 施工工程量信息管理 - 更新 | scope=C01 |
| 角色:C01Planner | `construction_volume:delete` | 施工工程量信息管理 - 删除 | scope=C01 |
| 角色:C01Planner | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `exhibition_report:read` | 展报管理 - 查看 | scope=C01 |
| 角色:C01Planner | `abd_volume:read` | ABD工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `ovr_volume:read` | OVR工程量信息管理 - 查看 | scope=C01 |
| 角色:C01Planner | `daily_report:read` | 日报管理 - 查看 | scope=C01 |
| 角色:C01Planner | `daily_report:create` | 日报管理 - 创建 | scope=C01 |
| 角色:C01Planner | `p6_database:read` | P6数据库管理 - 查看 | scope=C01 |
| 角色:C01Planner | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:C01Planner | `planning:update` | 计划管理 - 更新 | scope=C01 |
| 角色:C01Planner | `daily_report:update` | 日报管理 - 更新 | scope=C01 |
| 角色:C01Planner | `daily_report:delete` | 日报管理 - 删除 | scope=C01 |

## wangbaidong (id=12)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## wangqianqian (id=24)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## wangyibei (id=5)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## xieguangjie (id=2)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划经理 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划经理 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划经理 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划经理 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划经理 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划经理 | `exhibition_report:create` | 展报管理 - 创建 | （全范围） |
| 角色:计划经理 | `exhibition_report:update` | 展报管理 - 更新 | （全范围） |
| 角色:计划经理 | `exhibition_report:delete` | 展报管理 - 删除 | （全范围） |
| 角色:计划经理 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划经理 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划经理 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划经理 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划经理 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划经理 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划经理 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划经理 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划经理 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划经理 | `ovr_volume:create` | OVR工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `ovr_volume:update` | OVR工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `ovr_volume:delete` | OVR工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:update` | ABD工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `acceptance_volume:create` | 验收工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:update` | 验收工程量信息管理 - 更新 | （全范围） |
| 角色:计划经理 | `abd_volume:delete` | ABD工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `abd_volume:create` | ABD工程量信息管理 - 创建 | （全范围） |
| 角色:计划经理 | `acceptance_volume:delete` | 验收工程量信息管理 - 删除 | （全范围） |
| 角色:计划经理 | `p6_database:update` | P6数据库管理 - 更新 | （全范围） |
| 角色:计划经理 | `p6_database:sync` | P6数据库管理 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:sync` | 焊接数据 - 同步 | （全范围） |
| 角色:计划经理 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划经理 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划经理 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划经理 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## xudongmei (id=18)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## yangzhi (id=23)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## yaoshihao (id=17)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## zhangshuheng (id=21)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## zhangxianjian (id=11)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |

## zhangxin (id=19)

| 来源 | 权限代码 | 权限名称 | 范围 |
|------|----------|----------|------|
| 角色:计划主管 | `exhibition_report:read` | 展报管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:read` | 计划管理 - 查看 | （全范围） |
| 角色:计划主管 | `planning:create` | 计划管理 - 创建 | （全范围） |
| 角色:计划主管 | `planning:update` | 计划管理 - 更新 | （全范围） |
| 角色:计划主管 | `planning:delete` | 计划管理 - 删除 | （全范围） |
| 角色:计划主管 | `construction_volume:read` | 施工工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `construction_volume:create` | 施工工程量信息管理 - 创建 | （全范围） |
| 角色:计划主管 | `construction_volume:update` | 施工工程量信息管理 - 更新 | （全范围） |
| 角色:计划主管 | `construction_volume:delete` | 施工工程量信息管理 - 删除 | （全范围） |
| 角色:计划主管 | `daily_report:read` | 日报管理 - 查看 | （全范围） |
| 角色:计划主管 | `daily_report:create` | 日报管理 - 创建 | （全范围） |
| 角色:计划主管 | `daily_report:update` | 日报管理 - 更新 | （全范围） |
| 角色:计划主管 | `daily_report:delete` | 日报管理 - 删除 | （全范围） |
| 角色:计划主管 | `p6_database:read` | P6数据库管理 - 查看 | （全范围） |
| 角色:计划主管 | `p6_sync:read` | P6同步管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:read` | 主项清单管理 - 查看 | （全范围） |
| 角色:计划主管 | `facility:create` | 主项清单管理 - 创建 | （全范围） |
| 角色:计划主管 | `facility:update` | 主项清单管理 - 更新 | （全范围） |
| 角色:计划主管 | `facility:delete` | 主项清单管理 - 删除 | （全范围） |
| 角色:计划主管 | `acceptance_volume:read` | 验收工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `abd_volume:read` | ABD工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `ovr_volume:read` | OVR工程量信息管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:read` | 焊接数据管理 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:read` | 焊接数据配置 - 查看 | （全范围） |
| 角色:计划主管 | `welding_data:config:create` | 焊接数据配置 - 创建 | （全范围） |
| 角色:计划主管 | `welding_data:config:update` | 焊接数据配置 - 更新 | （全范围） |
| 角色:计划主管 | `welding_data:config:delete` | 焊接数据配置 - 删除 | （全范围） |
