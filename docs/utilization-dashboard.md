# 利用率大盘（容量大盘）设计说明

> 状态：M1 已实现（实时聚合）；M2/M3 待迭代
> 页面：`/capacity`，组件目录 `frontend/src/components/capacity/`
> 接口：`/api/capacity/*`，路由文件 `backend/routes/capacity.js`

## 1. 目标

用一屏回答「机房还剩多少容量」：机柜 U 位、端口、IP 池、功耗、耗材，并给出预警清单与趋势。

## 2. 指标口径

| 指标 | 口径 | 数据来源 |
| --- | --- | --- |
| U 位利用率 | Σ在架设备 `height` / Σ机柜 `height`，按机柜裁剪到机柜高度 | `Device.height/position`、`Rack.height` |
| U 位碎片 | 单机柜最大连续空闲 U 数、U 位冲突数（重叠设备） | `Device.position/height` |
| 端口占用 | `occupied` / 端口总数；`fault` 单列 | `DevicePort.status` |
| IP 池 | `used` / (`used` + `free`)，`reserved/gateway/excluded` 不进分母 | `IpAddress.status` |
| 功耗 | Σ`Rack.currentPower`，全为 0 时回退 Σ`Device.powerConsumption`；分母 Σ`Rack.maxPower` | `Rack`、`Device` |
| 耗材周转 | 近 30 天出库量 / 当前总库存（估算，标注 `estimated`）；低库存数 = `currentStock <= minStock` | `Consumable`、`ConsumableRecord` |

预警阈值：U 位 / 功耗 80% 提醒、90% 严重；IP 池 85% 提醒、95% 严重。

## 3. 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/capacity/overview?roomId=` | 5 项指标 + 机房列表 + 预警清单 |
| GET | `/api/capacity/racks?roomId=&sort=utilization|power|devices&limit=` | 机柜明细（Top N） |
| GET | `/api/capacity/ip-pools?limit=` | 网段 IP 池使用率 |
| GET | `/api/capacity/trend?range=7|30|90&metric=u` | U 位占用趋势（基于 `createdAt` 反推，`estimated: true`） |

权限：`capacity:view` 或 `dashboard:view`（兼容存量角色，无需重新分配即可访问）。

## 4. 页面结构

1. 顶部：机房筛选、刷新、数据更新时间。
2. KPI 行：U 位、端口、IP 池、功耗、耗材周转、预警数量。
3. 中部：机柜 U 位 Top10 条形榜（80% 警戒线）、端口类型环图、预警清单。
4. 底部：U 位占用趋势（估算折线）。
5. 钻取：机柜 → `/visualization-3d`；IP → `/ipam`；耗材 → `/consumables-stats`。

## 5. 后续迭代

- M2：`capacity_snapshots` 日快照表 + 真实趋势 + 最小二乘预测 + 阈值配置化。
- M3：`Rack.maxWeight`、`Device.weight` 承重指标与录入校验、Excel 导出（`capacity:export`）。