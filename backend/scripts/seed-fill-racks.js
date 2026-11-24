/**
 * IDC 设备管理系统 - 补齐机柜设备至 10 台/柜
 *
 * 需求: 每机柜 10 台设备
 * 待补: A-01(+7), A-02(+7), B-01(+10)
 * IP: 使用 10.200.rackIdx.x 段避免与现有 10.0.x 冲突
 */
const { sequelize } = require('../db');
const Rack = require('../models/Rack');
const Device = require('../models/Device');
const Subnet = require('../models/Subnet');
const IpAddress = require('../models/IpAddress');
const NetworkCard = require('../models/NetworkCard');
const DevicePort = require('../models/DevicePort');
const { generateId } = require('../utils/idGenerator');

// 补充设备模板 (每机柜需补足到10台)
const FILL_TEMPLATES = [
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
    console.log('=== 补齐机柜设备至 10 台/柜 ===');
    const subnet1 = await Subnet.findOne({ where: { name: '内网管理段' } });

    // 机柜目标: [机柜名, 机柜序号(用于IP段), 起始U位]
    const targets = [
      { rackName: 'A-01', rackIdx: 1, startPos: 17 },
      { rackName: 'A-02', rackIdx: 2, startPos: 10 },
      { rackName: 'B-01', rackIdx: 6, startPos: 2 },
    ];

    let deviceCount = 0, ipCount = 0, nicCount = 0;

    for (const { rackName, rackIdx, startPos } of targets) {
      const rack = await Rack.findOne({ where: { name: rackName } });
      if (!rack) { console.error(`机柜 ${rackName} 不存在`); continue; }

      const existing = await Device.findAll({ where: { rackId: rack.rackId } });
      const need = 10 - existing.length;
      if (need <= 0) { console.log(`${rackName} 已有 ${existing.length} 台，跳过`); continue; }

      console.log(`${rackName}: 现有 ${existing.length} 台，需补 ${need} 台 (从 ${startPos}U 起)`);

      let pos = startPos;
      for (let d = 0; d < need; d++) {
        const tpl = FILL_TEMPLATES[d % FILL_TEMPLATES.length];
        const idx = existing.length + d + 1; // 设备序号
        const deviceName = `${tpl.name}-${rackName}-${String(idx).padStart(2, '0')}`;
        const serialNum = `SN-${rackName}-${String(idx).padStart(2, '0')}`;
        const isNet = tpl.isNet;
        // 唯一IP段: 10.200.rackIdx.x 避开现有 10.0.x
        const ipBase = `10.200.${rackIdx}`;
        const ipLast = d + 10;
        const ipAddr = isNet ? `${ipBase}.${ipLast}` : null;

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
          ipAddress: ipAddr,
          description: `${tpl.name}（${rackName} 第${pos}U）`,
        });
        deviceCount++;

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

        if (tpl.type === 'server' && !isNet) {
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
          nicCount++;
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

        pos += tpl.height;
      }
    }

    console.log(`\n=== 完成 ===`);
    console.log(`新增设备: ${deviceCount}`);
    console.log(`新增IP: ${ipCount}`);
    console.log(`新增网卡: ${nicCount}`);
  } catch (e) {
    console.error('补齐失败:', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
