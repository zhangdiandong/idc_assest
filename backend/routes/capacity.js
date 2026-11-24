'use strict';

/**
 * 利用率大盘（容量大盘）接口
 *
 * 指标口径见 docs/utilization-dashboard.md
 * 全部聚合在应用层完成，避免 SQLite / MySQL 方言差异
 */

const logger = require('../utils/logger').module('Capacity');
const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { authMiddleware } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const Device = require('../models/Device');
const Rack = require('../models/Rack');
const Room = require('../models/Room');
const DevicePort = require('../models/DevicePort');
const { Subnet, IpAddress } = require('../models');
const Consumable = require('../models/Consumable');
const ConsumableRecord = require('../models/ConsumableRecord');
const Ticket = require('../models/Ticket');

const U_WARN = 80;
const U_DANGER = 90;
const POWER_WARN = 80;
const POWER_DANGER = 90;
const IP_WARN = 85;
const IP_DANGER = 95;

/** SQLite 单条语句变量上限为 999，超过则退回全局统计 */
const MAX_IN_LIST = 900;

const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;

/** 端口状态兼容：历史数据存在 active / ethernet 等非枚举值 */
const OCCUPIED_PORT_STATUS = new Set(['occupied', 'active', 'used', 'in-use', 'in_use']);
const FAULT_PORT_STATUS = new Set(['fault', 'error', 'broken']);
const FREE_PORT_STATUS = new Set(['free', 'available', 'idle']);

const normalizePortStatus = status => {
  if (OCCUPIED_PORT_STATUS.has(status)) return 'occupied';
  if (FAULT_PORT_STATUS.has(status)) return 'fault';
  if (FREE_PORT_STATUS.has(status)) return 'free';
  return 'other';
};

const percent = (used, total) => (total > 0 ? round1((used / total) * 100) : 0);

const levelOf = (value, warn = U_WARN, danger = U_DANGER) => {
  if (value >= danger) return 'danger';
  if (value >= warn) return 'warning';
  return 'normal';
};

const sumBy = (list, pick) => list.reduce((sum, item) => sum + (Number(pick(item)) || 0), 0);

/** 单机柜 U 位分析：占用、冲突、最大连续空闲段 */
const analyzeRackSlots = (devices, rackHeight) => {
  const height = Number(rackHeight) || 0;
  const occupied = new Array(height + 2).fill(0);
  let used = 0;

  devices.forEach(device => {
    const start = Number(device.position) || 0;
    const span = Math.max(Number(device.height) || 1, 1);
    if (start <= 0) return;

    const end = Math.min(start + span, height + 1);
    for (let u = start; u < end; u += 1) occupied[u] += 1;
    used += span;
  });

  let conflicts = 0;
  let largestGap = 0;
  let currentGap = 0;
  for (let u = 1; u <= height; u += 1) {
    if (occupied[u] > 1) conflicts += 1;
    if (occupied[u] === 0) {
      currentGap += 1;
      largestGap = Math.max(largestGap, currentGap);
    } else {
      currentGap = 0;
    }
  }

  return { used: Math.min(used, height), conflicts, largestGap };
};

/** 统计各状态的记录数，返回 { status: count } */
const countByStatus = async (Model, keyField, where = {}) => {
  const rows = await Model.findAll({
    where,
    attributes: ['status', [fn('COUNT', col(keyField)), 'count']],
    group: ['status'],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    acc[row.status] = Number(row.count) || 0;
    return acc;
  }, {});
};

/** 按机房解析机柜与在架设备上下文 */
const resolveScope = async roomId => {
  const racks = await Rack.findAll({
    where: roomId ? { roomId } : {},
    attributes: ['rackId', 'name', 'height', 'maxPower', 'currentPower', 'roomId', 'status'],
    raw: true,
  });

  const rackIds = racks.map(rack => rack.rackId);
  const devices = rackIds.length
    ? await Device.findAll({
        where: { rackId: { [Op.in]: rackIds } },
        attributes: [
          'deviceId',
          'name',
          'type',
          'rackId',
          'height',
          'position',
          'powerConsumption',
          'status',
          'isIdle',
          'warrantyExpiry',
        ],
        raw: true,
      })
    : [];

  return { racks, rackIds, devices };
};

/** 汇总 U 位与功耗指标 */
const aggregateRackMetrics = (racks, devices) => {
  const devicesByRack = devices.reduce((acc, device) => {
    if (!device.rackId) return acc;
    (acc[device.rackId] = acc[device.rackId] || []).push(device);
    return acc;
  }, {});

  let totalU = 0;
  let usedU = 0;
  let conflictU = 0;
  let conflictRacks = 0;
  let largestGap = 0;

  const rackMetrics = racks.map(rack => {
    const rackDevices = devicesByRack[rack.rackId] || [];
    const slots = analyzeRackSlots(rackDevices, rack.height);
    const devicePower = sumBy(rackDevices, item => item.powerConsumption);
    const power = Number(rack.currentPower) > 0 ? Number(rack.currentPower) : devicePower;

    totalU += Number(rack.height) || 0;
    usedU += slots.used;
    conflictU += slots.conflicts;
    largestGap = Math.max(largestGap, slots.largestGap);
    if (slots.conflicts > 0) conflictRacks += 1;

    return {
      rackId: rack.rackId,
      name: rack.name,
      roomId: rack.roomId,
      status: rack.status,
      height: Number(rack.height) || 0,
      usedU: slots.used,
      uUsage: percent(slots.used, Number(rack.height) || 0),
      conflicts: slots.conflicts,
      largestGap: slots.largestGap,
      deviceCount: rackDevices.length,
      power: round1(power),
      maxPower: round1(Number(rack.maxPower) || 0),
      powerUsage: percent(power, Number(rack.maxPower) || 0),
    };
  });

  const currentPower = sumBy(racks, rack => rack.currentPower);
  const devicePower = sumBy(devices, device => device.powerConsumption);
  const usedPower = currentPower > 0 ? currentPower : devicePower;
  const maxPower = sumBy(racks, rack => rack.maxPower);

  return {
    rackMetrics,
    u: {
      total: totalU,
      used: usedU,
      free: Math.max(totalU - usedU, 0),
      usage: percent(usedU, totalU),
      conflictU,
      conflictRacks,
      largestGap,
    },
    power: {
      used: round1(usedPower),
      max: round1(maxPower),
      free: round1(Math.max(maxPower - usedPower, 0)),
      usage: percent(usedPower, maxPower),
      source: currentPower > 0 ? 'rack' : 'device',
    },
  };
};

/** 端口占用统计 */
const aggregatePortMetrics = async (devices, scoped) => {
  const deviceIds = devices.map(device => device.deviceId).filter(Boolean);
  const canScope = scoped && deviceIds.length > 0 && deviceIds.length <= MAX_IN_LIST;
  const where = canScope ? { deviceId: { [Op.in]: deviceIds } } : {};

  const statusRows = await DevicePort.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('portId')), 'count']],
    group: ['status'],
    raw: true,
  });

  const typeRows = await DevicePort.findAll({
    where,
    attributes: ['portType', 'status', [fn('COUNT', col('portId')), 'count']],
    group: ['portType', 'status'],
    raw: true,
  });

  const statusCount = statusRows.reduce((acc, row) => {
    const key = normalizePortStatus(row.status);
    acc[key] = (acc[key] || 0) + (Number(row.count) || 0);
    return acc;
  }, {});

  const byTypeMap = new Map();
  typeRows.forEach(row => {
    const type = row.portType || '其他';
    const item = byTypeMap.get(type) || { type, total: 0, occupied: 0, free: 0, fault: 0 };
    const count = Number(row.count) || 0;
    const key = normalizePortStatus(row.status);
    item.total += count;
    if (key === 'occupied') item.occupied += count;
    if (key === 'free') item.free += count;
    if (key === 'fault') item.fault += count;
    byTypeMap.set(type, item);
  });

  const total = Object.values(statusCount).reduce((sum, count) => sum + count, 0);
  const occupied = statusCount.occupied || 0;
  const free = statusCount.free || 0;
  const fault = statusCount.fault || 0;

  return {
    total,
    occupied,
    free,
    fault,
    usage: percent(occupied, total),
    scoped: canScope,
    byType: Array.from(byTypeMap.values()).sort((a, b) => b.total - a.total),
  };
};

/** IP 池统计（全局） */
const aggregateIpMetrics = async () => {
  const statusCount = await countByStatus(IpAddress, 'ipId');
  const used = statusCount.used || 0;
  const free = statusCount.free || 0;
  const reserved = statusCount.reserved || 0;
  const gateway = statusCount.gateway || 0;
  const excluded = statusCount.excluded || 0;

  const subnets = await Subnet.findAll({ attributes: ['usableHosts'], raw: true });
  const usableHosts = sumBy(subnets, item => item.usableHosts);

  let denominator = usableHosts - gateway - reserved - excluded;
  if (denominator < used) denominator = used + free;

  return {
    total: Object.values(statusCount).reduce((sum, count) => sum + count, 0),
    used,
    free,
    reserved,
    gateway,
    excluded,
    usableHosts,
    usage: percent(used, denominator),
  };
};

/** 耗材周转统计（近 30 天，估算） */
const aggregateConsumableMetrics = async () => {
  const consumables = await Consumable.findAll({
    attributes: ['consumableId', 'currentStock', 'minStock'],
    raw: true,
  });

  const totalStock = sumBy(consumables, item => item.currentStock);
  const lowStockCount = consumables.filter(
    item => Number(item.currentStock) <= Number(item.minStock)
  ).length;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const outQuantity =
    (await ConsumableRecord.sum('quantity', {
      where: { type: 'out', createdAt: { [Op.gte]: since } },
    })) || 0;

  return {
    totalStock,
    lowStockCount,
    out30: Number(outQuantity) || 0,
    turnover: totalStock > 0 ? round2(Number(outQuantity) / totalStock) : 0,
    periodDays: 30,
    estimated: true,
  };
};

/** 保修到期统计（按当前范围内在架设备） */
const aggregateWarrantyMetrics = devices => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const result = { d30: 0, d60: 0, d90: 0, expired: 0, total: 0, within90: 0 };

  devices.forEach(device => {
    if (!device.warrantyExpiry) return;
    const expiry = new Date(device.warrantyExpiry).getTime();
    if (Number.isNaN(expiry)) return;

    result.total += 1;
    const remainDays = Math.ceil((expiry - now) / day);

    if (remainDays < 0) result.expired += 1;
    else if (remainDays <= 30) result.d30 += 1;
    else if (remainDays <= 60) result.d60 += 1;
    else if (remainDays <= 90) result.d90 += 1;
  });

  result.within90 = result.d30 + result.d60 + result.d90;
  return result;
};

/** 工单与故障设备统计 */
const aggregateTicketMetrics = async devices => {
  const rows = await Ticket.findAll({
    attributes: ['status', [fn('COUNT', col('ticketId')), 'count']],
    group: ['status'],
    raw: true,
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.status] = Number(row.count) || 0;
    return acc;
  }, {});

  const pending = counts.pending || 0;
  const inProgress = counts.in_progress || 0;
  const open = pending + inProgress + (counts.reopened || 0);

  const faultStatuses = new Set(['fault', 'error', 'broken', '故障']);
  const faultDevices = devices.filter(
    device => !device.isIdle && faultStatuses.has(String(device.status || '').toLowerCase())
  );

  const faultByType = new Map();
  faultDevices.forEach(device => {
    const type = device.type || '未分类';
    const item = faultByType.get(type) || { type, count: 0, names: [] };
    item.count += 1;
    if (item.names.length < 3) item.names.push(device.name);
    faultByType.set(type, item);
  });

  return {
    open,
    pending,
    inProgress,
    completed: counts.completed || 0,
    closed: counts.closed || 0,
    cancelled: counts.cancelled || 0,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    faultTotal: faultDevices.length,
    faultTop: Array.from(faultByType.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
};

/** 生成预警清单 */
const buildWarnings = ({ u, power, port, ip, consumable, rackMetrics }) => {
  const warnings = [];

  if (u.usage >= U_WARN) {
    warnings.push({
      type: 'u',
      level: levelOf(u.usage),
      title: '机柜 U 位紧张',
      description: `整体 U 位利用率 ${u.usage}%，剩余 ${u.free}U`,
      value: u.usage,
      link: '/racks',
    });
  }

  if (power.usage >= POWER_WARN) {
    warnings.push({
      type: 'power',
      level: levelOf(power.usage, POWER_WARN, POWER_DANGER),
      title: '机柜功耗接近上限',
      description: `当前 ${power.used} / ${power.max} kW（${power.usage}%）`,
      value: power.usage,
      link: '/racks',
    });
  }

  if (u.conflictRacks > 0) {
    warnings.push({
      type: 'conflict',
      level: 'warning',
      title: 'U 位冲突',
      description: `${u.conflictRacks} 个机柜存在设备 U 位重叠，共 ${u.conflictU}U`,
      value: u.conflictRacks,
      link: '/visualization-3d',
    });
  }

  if (ip.usage >= IP_WARN) {
    warnings.push({
      type: 'ip',
      level: levelOf(ip.usage, IP_WARN, IP_DANGER),
      title: 'IP 地址池不足',
      description: `已用 ${ip.used} 个，剩余 ${ip.free} 个可用地址`,
      value: ip.usage,
      link: '/ipam',
    });
  }

  if (consumable.lowStockCount > 0) {
    warnings.push({
      type: 'consumable',
      level: 'warning',
      title: '耗材低于安全库存',
      description: `${consumable.lowStockCount} 种耗材库存不足`,
      value: consumable.lowStockCount,
      link: '/consumables-stats',
    });
  }

  const hotRacks = rackMetrics.filter(rack => rack.uUsage >= U_DANGER).slice(0, 3);
  hotRacks.forEach(rack => {
    warnings.push({
      type: 'rack',
      level: 'danger',
      title: `机柜 ${rack.name} U 位告急`,
      description: `已用 ${rack.usedU}/${rack.height}U（${rack.uUsage}%）`,
      value: rack.uUsage,
      link: '/visualization-3d',
    });
  });

  return warnings.sort((a, b) => b.value - a.value);
};

router.use(authMiddleware, requirePermission('capacity:view', 'dashboard:view'));

/** GET /api/capacity/overview?roomId= */
router.get('/overview', async (req, res) => {
  try {
    const { roomId } = req.query;
    const rooms = await Room.findAll({
      attributes: ['roomId', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    const { racks, devices } = await resolveScope(roomId);
    const rackAggregate = aggregateRackMetrics(racks, devices);
    const warranty = aggregateWarrantyMetrics(devices);
    const [port, ip, consumable, tickets] = await Promise.all([
      aggregatePortMetrics(devices, Boolean(roomId)),
      aggregateIpMetrics(),
      aggregateConsumableMetrics(),
      aggregateTicketMetrics(devices),
    ]);

    const currentRoom = roomId ? rooms.find(room => room.roomId === roomId) : null;

    res.json({
      scope: {
        roomId: roomId || null,
        roomName: currentRoom ? currentRoom.name : null,
        roomCount: rooms.length,
        rackCount: racks.length,
        deviceCount: devices.length,
      },
      u: rackAggregate.u,
      power: rackAggregate.power,
      port,
      ip,
      consumable,
      warranty,
      tickets,
      rooms,
      warnings: buildWarnings({
        u: rackAggregate.u,
        power: rackAggregate.power,
        port,
        ip,
        consumable,
        rackMetrics: rackAggregate.rackMetrics,
      }),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取容量概览失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取容量概览失败' });
  }
});

/** GET /api/capacity/racks?roomId=&sort=&limit=&order= */
router.get('/racks', async (req, res) => {
  try {
    const { roomId, sort = 'utilization', limit = 10, order = 'desc' } = req.query;
    const { racks, devices } = await resolveScope(roomId);
    const { rackMetrics, u, power } = aggregateRackMetrics(racks, devices);

    const sortKey = ['utilization', 'power', 'devices'].includes(sort) ? sort : 'utilization';
    const pick = {
      utilization: rack => rack.uUsage,
      power: rack => rack.powerUsage,
      devices: rack => rack.deviceCount,
    }[sortKey];

    const direction = order === 'asc' ? 1 : -1;
    const sorted = [...rackMetrics].sort((a, b) => (pick(a) - pick(b)) * direction);
    const maxLimit = Math.min(Math.max(Number(limit) || 10, 1), 200);

    res.json({
      summary: { u, power, rackCount: racks.length },
      items: sorted.slice(0, maxLimit),
      total: sorted.length,
    });
  } catch (error) {
    logger.error('获取机柜容量明细失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取机柜容量明细失败' });
  }
});

/** GET /api/capacity/ip-pools?limit= */
router.get('/ip-pools', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const subnets = await Subnet.findAll({
      attributes: ['subnetId', 'name', 'cidr', 'ipVersion', 'usableHosts', 'gateway'],
      raw: true,
    });

    const rows = await IpAddress.findAll({
      attributes: ['subnetId', 'status', [fn('COUNT', col('ipId')), 'count']],
      group: ['subnetId', 'status'],
      raw: true,
    });

    const subnetMap = new Map();
    rows.forEach(row => {
      if (!row.subnetId) return;
      const item = subnetMap.get(row.subnetId) || {
        used: 0,
        free: 0,
        reserved: 0,
        gateway: 0,
        excluded: 0,
      };
      item[row.status] = (item[row.status] || 0) + (Number(row.count) || 0);
      subnetMap.set(row.subnetId, item);
    });

    const items = subnets
      .map(subnet => {
        const stats = subnetMap.get(subnet.subnetId) || {
          used: 0,
          free: 0,
          reserved: 0,
          gateway: 0,
          excluded: 0,
        };
        const usableHosts = Number(subnet.usableHosts) || 0;
        let denominator = usableHosts - stats.gateway - stats.reserved - stats.excluded;
        if (denominator < stats.used) denominator = stats.used + stats.free;

        return {
          subnetId: subnet.subnetId,
          name: subnet.name,
          cidr: subnet.cidr,
          ipVersion: subnet.ipVersion,
          usableHosts,
          used: stats.used,
          free: stats.free,
          reserved: stats.reserved,
          gateway: stats.gateway,
          excluded: stats.excluded,
          usage: percent(stats.used, denominator),
        };
      })
      .filter(item => item.used + item.free > 0)
      .sort((a, b) => b.usage - a.usage)
      .slice(0, limit);

    res.json({ items, total: subnets.length });
  } catch (error) {
    logger.error('获取 IP 池容量失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取 IP 池容量失败' });
  }
});

/** GET /api/capacity/trend?range=7|30|90&metric=u */
router.get('/trend', async (req, res) => {
  try {
    const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;
    const { roomId } = req.query;
    const { racks, devices } = await resolveScope(roomId);
    const currentUsedU = aggregateRackMetrics(racks, devices).u.used;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (range - 1));

    const added = devices
      .map(device => ({
        createdAt: device.createdAt ? new Date(device.createdAt) : null,
        height: Math.max(Number(device.height) || 1, 1),
      }))
      .filter(item => item.createdAt && item.createdAt >= start);

    const points = [];
    for (let i = 0; i < range; i += 1) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const addedAfter = added
        .filter(item => item.createdAt > dayEnd)
        .reduce((sum, item) => sum + item.height, 0);

      points.push({
        date: `${`${dayStart.getMonth() + 1}`.padStart(2, '0')}-${`${dayStart.getDate()}`.padStart(2, '0')}`,
        value: Math.max(currentUsedU - addedAfter, 0),
      });
    }

    res.json({
      metric: 'u',
      range,
      estimated: true,
      note: 'M1 阶段基于设备创建时间反推，接入日快照后为真实历史',
      points,
    });
  } catch (error) {
    logger.error('获取容量趋势失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取容量趋势失败' });
  }
});

module.exports = router;