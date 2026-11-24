/**
 * IDC 设备管理系统 - 重排机柜设备
 *
 * 需求: 网络设备放在上方，设备之间间隔 1U 存放
 * 规则:
 *  - 网络设备(switch/router/firewall)在机柜顶部
 *  - 服务器在下方
 *  - 每台设备之后留 1U 间隔
 *
 * 用法: node scripts/reorder-racks.js
 */
const { sequelize } = require('../db');
const Rack = require('../models/Rack');
const Device = require('../models/Device');

// 网络设备类型
const NET_TYPES = ['switch', 'router', 'firewall'];

(async () => {
  try {
    console.log('=== 重排机柜设备 (网络在上, 间隔1U) ===');
    const racks = await Rack.findAll();
    let moved = 0;

    for (const rack of racks) {
      const devices = await Device.findAll({ where: { rackId: rack.rackId } });
      if (devices.length === 0) continue;

      // 分两组: 网络设备 / 服务器
      const netDevices = devices.filter(d => NET_TYPES.includes(d.type));
      const srvDevices = devices.filter(d => !NET_TYPES.includes(d.type));

      // 网络设备: 1U 高度，从 pos 1 开始，间隔 1U → 1,3,5,7,...
      let netPos = 1;
      const netAssignments = netDevices.map(d => {
        const p = netPos;
        netPos += d.height + 1; // 高度 + 1U间隔
        return { d, pos: p };
      });

      // 服务器: 从网络设备结束处开始
      let srvPos = netPos;
      const srvAssignments = srvDevices.map(d => {
        const p = srvPos;
        srvPos += d.height + 1; // 高度 + 1U间隔
        return { d, pos: p };
      });

      // 应用新位置
      const all = [...netAssignments, ...srvAssignments];
      for (const { d, pos } of all) {
        if (d.position !== pos) {
          await Device.update({ position: pos }, { where: { deviceId: d.deviceId } });
          moved++;
        }
      }

      const netNames = netDevices.map(d => d.name).join(', ');
      console.log(`${rack.name}: 网络设备 ${netDevices.length}台 + 服务器 ${srvDevices.length}台`);
      console.log(`  网络区: ${netAssignments.map(a => `${a.d.name}@${a.pos}U`).join(', ')}`);
      console.log(`  服务器区: ${srvAssignments.map(a => `${a.d.name}@${a.pos}U`).join(', ')}`);
    }

    console.log(`\n=== 完成 ===`);
    console.log(`共移动 ${moved} 台设备位置`);
  } catch (e) {
    console.error('重排失败:', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
