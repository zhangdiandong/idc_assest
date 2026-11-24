/**
 * IDC 设备管理系统 - 批量机柜与设备种子脚本
 *
 * 需求: 每个机房 5 个机柜，每机柜 10 台设备（网络设备 + 服务器）
 * 现有: A栋(A-01,A-02) B栋(B-01)
 * 需补: A栋 A-03~A-05, B栋 B-02~B-05 共 7 个机柜
 * 每个新增机柜: 10 台设备
 *
 * 用法: node scripts/seed-racks-devices.js
 * 幂等: 机柜名已存在则跳过
 */
const { sequelize } = require('../db');
const Rack = require('../models/Rack');
const Device = require('../models/Device');
const Room = require('../models/Room');
const Subnet = require('../models/Subnet');
const IpAddress = require('../models/IpAddress');
const NetworkCard = require('../models/NetworkCard');
const DevicePort = require('../models/DevicePort');
const Business = require('../models/Business');
const DeviceBusiness = require('../models/DeviceBusiness');
const { generateId } = require('../utils/idGenerator');

async function roomByName(name) {
  return Room.findOne({ where: { name } });
}

// 设备模板: 网络设备 4 台 + 服务器 6 台
const DEVICE_TEMPLATES = [
  { name: '接入交换机', type: 'switch', model: 'H3C S5130S', height: 1, power: 120, isNet: true, portCount: 24 },
  { name: '汇聚交换机', type: 'switch', model: 'H3C S5560X', height: 1, power: 180, isNet: true, portCount: 48 },
  { name: '路由器', type: 'router', model: '华为 AR1220', height: 1, power: 90, isNet: true, portCount: 8 },
  { name: '防火墙', type: 'firewall', model: '深信服 AF-1000', height: 1, power: 150, isNet: true, portCount: 6 },
  { name: '数据库服务器', type: 'server', model: '戴尔 R740', height: 2, power: 500, isNet: false, portCount: 4 },
  { name: '应用服务器', type: 'server', model: '戴尔 R750', height: 2, power: 480, isNet: false, portCount: 4 },
  { name: 'WEB服务器', type: 'server', model: '浪潮 NF5280', height: 2, power: 450, isNet: false, portCount: 4 },
  { name: '文件服务器', type: 'server', model: '联想 SR650', height: 2, power: 420, isNet: false, portCount: 4 },
  { name: '备份服务器', type: 'server', model: '戴尔 R740xd', height: 2, power: 520, isNet: false, portCount: 4 },
  { name: '虚拟化主机', type: 'server', model: '华为 2288H V5', height: 2, power: 560, isNet: false, portCount: 4 },
];

(async () => {
  try {
    console.log('=== 批量生成机柜与设备 ===');
    const roomA = await roomByName('A栋数据中心机房');
    const roomB = await roomByName('B栋灾备机房');
    if (!roomA || !roomB) { console.error('机房不存在'); return; }

    const subnet1 = await Subnet.findOne({ where: { name: '内网管理段' } });
    const subnet2 = await Subnet.findOne({ where: { name: '业务网段' } });
    const biz1 = await Business.findOne({ where: { name: '核心业务系统' } });
    const biz2 = await Business.findOne({ where: { name: '数据仓库' } });

    const plan = [
      { room: roomA, prefix: 'A', start: 3, end: 5 },
      { room: roomB, prefix: 'B', start: 2, end: 5 },
    ];

    // 全局机柜序号，用于生成唯一 IP 段：每个机柜分配独立的 /24 子网段
    // 机柜序号 = (机房索引*5) + 机柜内序号，确保跨机房不冲突
    let globalRackIdx = 0;

    let rackCount = 0, deviceCount = 0, ipCount = 0;

    for (const { room, prefix, start, end } of plan) {
      for (let i = start; i <= end; i++) {
        globalRackIdx++;
        const rackName = `${prefix}-${String(i).padStart(2, '0')}`;
        const existRack = await Rack.findOne({ where: { name: rackName } });
        if (existRack) { console.log(`机柜 ${rackName} 已存在，跳过`); continue; }

        const rack = await Rack.create({
          rackId: generateId({ prefix: 'RACK' }),
          name: rackName,
          height: 42,
          maxPower: 8000,
          currentPower: 0,
          status: 'active',
          roomId: room.roomId,
          rowPos: Math.ceil(i / 3),
          colPos: ((i - 1) % 3) + 1,
          facing: 'front',
        });
        rackCount++;
        console.log(`创建机柜: ${rackName}`);

        // 每机柜 10 台设备
        let pos = 2; // 从 2U 开始（1U 留电源）
        // 为每个机柜分配唯一 IP 段：网络设备用 10.{rackIdx}.x，服务器用 10.{rackIdx+50}.x
        // 机柜序号从 1 开始，A栋(1-5), B栋(6-9)，跨机房唯一
        const netIpBase = `10.${globalRackIdx}`;
        const srvIpBase = `10.${globalRackIdx + 50}`;

        for (let d = 0; d < DEVICE_TEMPLATES.length; d++) {
          const tpl = DEVICE_TEMPLATES[d];
          const serialNum = `SN-${prefix}-${String(i).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
          const deviceName = `${tpl.name}-${prefix}${String(i).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
          const isNet = tpl.isNet;
          const ipBase = isNet ? netIpBase : srvIpBase;
          const ipLast = d + 10; // 每机柜设备 IP 从 .10 开始，避免网关冲突
          const ipAddr = isNet ? `${ipBase}.${ipLast}` : `${srvIpBase}.${ipLast}`;

          const device = await Device.create({
            deviceId: generateId({ prefix: 'DEV' }),
            name: deviceName,
            type: tpl.type,
            model: tpl.model,
            serialNumber: serialNum,
            rackId: rack.rackId,
            position: pos,
            height: tpl.height,
            powerConsumption: tpl.power,
            status: 'active',
            isIdle: false,
            sourceType: 'purchase',
            purchaseDate: '2025-06-01',
            warrantyExpiry: '2028-06-01',
            ipAddress: isNet ? ipAddr : null,
            description: `${tpl.name}（${rackName} 第${pos}U）`,
          });
          deviceCount++;

          // 网络设备加 IP
          if (isNet) {
            await IpAddress.create({
              ipId: generateId({ prefix: 'IP' }),
              subnetId: subnet1.subnetId,
              ipVersion: 4,
              ipAddress: ipAddr,
              ipInt: parseInt(ipAddr.split('.').reduce((a, b) => (a << 8) + parseInt(b), 0) >>> 0, 10),
              status: 'used',
              ipType: 'static',
              label: `${deviceName} 管理IP`,
              description: `${deviceName} 管理IP`,
              deviceId: device.deviceId,
              assignmentType: 'manual',
            });
            ipCount++;
          }

          // 服务器加网卡+端口
          if (tpl.type === 'server' && !tpl.isNet) {
            const nic = await NetworkCard.create({
              nicId: generateId({ prefix: 'NIC' }),
              deviceId: device.deviceId,
              name: '板载网卡',
              description: '板载双口千兆网卡',
              slotNumber: 0,
              portCount: 2,
              model: 'Intel I350',
              manufacturer: 'Intel',
              status: 'active',
            });
            await DevicePort.create({
              portId: generateId({ prefix: 'PORT' }),
              deviceId: device.deviceId,
              nicId: nic.nicId,
              portName: 'eth0',
              portType: 'ethernet',
              portSpeed: '1000M',
              status: 'active',
              vlanId: 20,
              description: '业务网口',
            });
          }

          // 部分设备关联业务
          if (biz1 && (d === 4 || d === 5)) {
            await DeviceBusiness.create({ deviceId: device.deviceId, businessId: biz1.businessId, isPrimary: true });
          }
          if (biz2 && d === 7) {
            await DeviceBusiness.create({ deviceId: device.deviceId, businessId: biz2.businessId, isPrimary: true });
          }

          pos += tpl.height;
        }
      }
    }

    console.log(`\n=== 完成 ===`);
    console.log(`新增机柜: ${rackCount}`);
    console.log(`新增设备: ${deviceCount}`);
    console.log(`新增IP: ${ipCount}`);
  } catch (e) {
    console.error('批量生成失败:', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
