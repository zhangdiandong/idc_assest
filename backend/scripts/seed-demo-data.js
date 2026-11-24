/**
 * IDC 设备管理系统 - 测试数据种子脚本
 *
 * 用法: node scripts/seed-demo-data.js
 * 幂等: 若关键数据已存在则跳过
 *
 * 生成数据:
 *  - 2 个机房 (A栋机房1、B栋机房2)
 *  - 4 个机柜
 *  - 6 台设备 (交换机/服务器/路由器/防火墙)
 *  - 2 个仓库
 *  - 2 个子网 + IP 地址
 *  - 网卡 + 端口
 *  - 业务线
 *  - 线缆连接
 *  - 耗材分类 + 耗材
 *  - 测试普通用户 (viewer 角色)
 */
const bcrypt = require('bcryptjs');
const { sequelize } = require('../db');
const Room = require('../models/Room');
const Rack = require('../models/Rack');
const Device = require('../models/Device');
const Warehouse = require('../models/Warehouse');
const Subnet = require('../models/Subnet');
const IpAddress = require('../models/IpAddress');
const NetworkCard = require('../models/NetworkCard');
const DevicePort = require('../models/DevicePort');
const Business = require('../models/Business');
const DeviceBusiness = require('../models/DeviceBusiness');
const Cable = require('../models/Cable');
const ConsumableCategory = require('../models/ConsumableCategory');
const Consumable = require('../models/Consumable');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const { generateId } = require('../utils/idGenerator');

async function exists(model, where) {
  return !!(await model.findOne({ where }));
}

(async () => {
  try {
    console.log('=== 开始生成测试数据 ===');

    // ---------- 1. 机房 ----------
    if (!(await exists(Room, { name: 'A栋数据中心机房' }))) {
      const roomA = await Room.create({
        roomId: generateId({ prefix: 'ROOM' }),
        name: 'A栋数据中心机房',
        location: 'A栋 3层',
        area: 120,
        capacity: 40,
        status: 'active',
        description: '核心生产机房，承载主要业务',
        gridRows: 4,
        gridCols: 6,
      });
      console.log(`机房A: ${roomA.roomId}`);

      const roomB = await Room.create({
        roomId: generateId({ prefix: 'ROOM' }),
        name: 'B栋灾备机房',
        location: 'B栋 1层',
        area: 80,
        capacity: 20,
        status: 'active',
        description: '灾备机房，用于容灾演练',
        gridRows: 3,
        gridCols: 4,
      });
      console.log(`机房B: ${roomB.roomId}`);

      // ---------- 2. 机柜 ----------
      const rackA1 = await Rack.create({
        rackId: generateId({ prefix: 'RACK' }),
        name: 'A-01',
        height: 42,
        maxPower: 8000,
        currentPower: 3200,
        status: 'active',
        roomId: roomA.roomId,
        rowPos: 1,
        colPos: 1,
        facing: 'front',
      });
      const rackA2 = await Rack.create({
        rackId: generateId({ prefix: 'RACK' }),
        name: 'A-02',
        height: 42,
        maxPower: 8000,
        currentPower: 2100,
        status: 'active',
        roomId: roomA.roomId,
        rowPos: 1,
        colPos: 2,
        facing: 'front',
      });
      const rackB1 = await Rack.create({
        rackId: generateId({ prefix: 'RACK' }),
        name: 'B-01',
        height: 42,
        maxPower: 8000,
        currentPower: 0,
        status: 'active',
        roomId: roomB.roomId,
        rowPos: 1,
        colPos: 1,
        facing: 'front',
      });
      console.log(`机柜: ${rackA1.name}, ${rackA2.name}, ${rackB1.name}`);

      // ---------- 3. 设备 ----------
      const deviceSwitch = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '核心交换机-SW01',
        type: 'switch',
        model: 'H3C S7500E',
        serialNumber: 'SN-SW-001',
        rackId: rackA1.rackId,
        position: 1,
        height: 8,
        powerConsumption: 650,
        status: 'active',
        isIdle: false,
        sourceType: 'purchase',
        purchaseDate: '2025-03-15',
        warrantyExpiry: '2028-03-15',
        ipAddress: '10.0.0.1',
        description: '核心交换，承载内网主干',
      });
      const deviceRouter = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '出口路由器-R01',
        type: 'router',
        model: '华为 AR6280',
        serialNumber: 'SN-RT-001',
        rackId: rackA1.rackId,
        position: 10,
        height: 4,
        powerConsumption: 420,
        status: 'active',
        isIdle: false,
        sourceType: 'purchase',
        purchaseDate: '2025-03-15',
        warrantyExpiry: '2028-03-15',
        ipAddress: '10.0.0.254',
        description: '出口网关，连接运营商',
      });
      const deviceFirewall = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '防火墙-FW01',
        type: 'firewall',
        model: '深信服 AF-2000',
        serialNumber: 'SN-FW-001',
        rackId: rackA1.rackId,
        position: 15,
        height: 2,
        powerConsumption: 350,
        status: 'active',
        isIdle: false,
        sourceType: 'purchase',
        purchaseDate: '2025-06-01',
        warrantyExpiry: '2027-06-01',
        ipAddress: '10.0.0.2',
        description: '边界防火墙',
      });
      const deviceServer1 = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '数据库服务器-DB01',
        type: 'server',
        model: '戴尔 PowerEdge R740',
        serialNumber: 'SN-SRV-001',
        rackId: rackA2.rackId,
        position: 2,
        height: 2,
        powerConsumption: 550,
        status: 'active',
        isIdle: false,
        sourceType: 'purchase',
        purchaseDate: '2025-01-20',
        warrantyExpiry: '2028-01-20',
        ipAddress: '10.0.1.10',
        description: '生产数据库',
      });
      const deviceServer2 = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '应用服务器-APP01',
        type: 'server',
        model: '戴尔 PowerEdge R750',
        serialNumber: 'SN-SRV-002',
        rackId: rackA2.rackId,
        position: 5,
        height: 2,
        powerConsumption: 480,
        status: 'active',
        isIdle: false,
        sourceType: 'purchase',
        purchaseDate: '2025-02-10',
        warrantyExpiry: '2028-02-10',
        ipAddress: '10.0.1.20',
        description: '业务应用服务器',
      });
      const deviceIdle = await Device.create({
        deviceId: generateId({ prefix: 'DEV' }),
        name: '备用服务器-SPARE01',
        type: 'server',
        model: '浪潮 NF5280M6',
        serialNumber: 'SN-SRV-003',
        rackId: rackA2.rackId,
        position: 8,
        height: 2,
        powerConsumption: 0,
        status: 'idle',
        isIdle: true,
        idleDate: '2026-10-01',
        idleReason: '业务迁移至新设备，等待重新分配',
        sourceType: 'purchase',
        purchaseDate: '2024-12-01',
        warrantyExpiry: '2027-12-01',
        ipAddress: '10.0.1.30',
        description: '闲置备用服务器',
      });
      console.log(`设备: ${deviceSwitch.name}, ${deviceRouter.name}, ${deviceFirewall.name}, ${deviceServer1.name}, ${deviceServer2.name}, ${deviceIdle.name}`);

      // ---------- 4. 仓库 ----------
      const wh1 = await Warehouse.create({
        warehouseId: generateId({ prefix: 'WH' }),
        name: '主备件仓库',
        location: 'A栋负1层',
        capacity: 500,
        status: 'active',
        description: '存放主要备件与耗材',
      });
      const wh2 = await Warehouse.create({
        warehouseId: generateId({ prefix: 'WH' }),
        name: '闲置设备仓库',
        location: 'C栋 2层',
        capacity: 200,
        status: 'active',
        description: '存放闲置及待报废设备',
      });
      console.log(`仓库: ${wh1.name}, ${wh2.name}`);

      // ---------- 5. 子网 ----------
      const subnet1 = await Subnet.create({
        subnetId: generateId({ prefix: 'SUB' }),
        name: '内网管理段',
        ipVersion: 4,
        cidr: '10.0.0.0/24',
        networkAddress: '10.0.0.0',
        broadcastAddress: '10.0.0.255',
        netmask: '255.255.255.0',
        prefixLength: 24,
        startInt: 167772160,
        endInt: 167772415,
        totalHosts: 256,
        usableHosts: 254,
        gateway: '10.0.0.254',
        dns: '114.114.114.114',
        vlanId: 10,
        autoGenerated: false,
        purpose: '管理网络',
        description: '核心设备管理网段',
      });
      const subnet2 = await Subnet.create({
        subnetId: generateId({ prefix: 'SUB' }),
        name: '业务网段',
        ipVersion: 4,
        cidr: '10.0.1.0/24',
        networkAddress: '10.0.1.0',
        broadcastAddress: '10.0.1.255',
        netmask: '255.255.255.0',
        prefixLength: 24,
        startInt: 167772416,
        endInt: 167772671,
        totalHosts: 256,
        usableHosts: 254,
        gateway: '10.0.1.254',
        dns: '114.114.114.114',
        vlanId: 20,
        autoGenerated: false,
        purpose: '业务网络',
        description: '服务器业务网段',
      });
      console.log(`子网: ${subnet1.name}, ${subnet2.name}`);

      // ---------- 6. IP 地址 ----------
      const ips = [
        { ip: '10.0.0.1', subnetId: subnet1.subnetId, deviceId: deviceSwitch.deviceId, label: '核心交换机管理IP' },
        { ip: '10.0.0.2', subnetId: subnet1.subnetId, deviceId: deviceFirewall.deviceId, label: '防火墙管理IP' },
        { ip: '10.0.0.254', subnetId: subnet1.subnetId, deviceId: deviceRouter.deviceId, label: '路由器出口IP' },
        { ip: '10.0.1.10', subnetId: subnet2.subnetId, deviceId: deviceServer1.deviceId, label: 'DB01业务IP' },
        { ip: '10.0.1.20', subnetId: subnet2.subnetId, deviceId: deviceServer2.deviceId, label: 'APP01业务IP' },
        { ip: '10.0.1.30', subnetId: subnet2.subnetId, deviceId: deviceIdle.deviceId, label: '备用服务器IP' },
      ];
      for (const item of ips) {
        await IpAddress.create({
          ipId: generateId({ prefix: 'IP' }),
          subnetId: item.subnetId,
          ipVersion: 4,
          ipAddress: item.ip,
          ipInt: parseInt(item.ip.split('.').reduce((a, b) => (a << 8) + parseInt(b), 0) >>> 0, 10),
          status: 'used',
          ipType: 'static',
          label: item.label,
          description: item.label,
          deviceId: item.deviceId,
          assignmentType: 'manual',
        });
      }
      console.log(`IP 地址: ${ips.length} 条`);

      // ---------- 7. 网卡 + 端口 ----------
      const nic1 = await NetworkCard.create({
        nicId: generateId({ prefix: 'NIC' }),
        deviceId: deviceSwitch.deviceId,
        name: '主控板',
        description: '交换主控板',
        slotNumber: 1,
        portCount: 48,
        model: 'S7500E-Main',
        manufacturer: 'H3C',
        status: 'active',
      });
      await DevicePort.create({
        portId: generateId({ prefix: 'PORT' }),
        deviceId: deviceSwitch.deviceId,
        nicId: nic1.nicId,
        portName: 'GE0/0/1',
        portType: 'ethernet',
        portSpeed: '1000M',
        status: 'active',
        vlanId: 10,
        description: '上联出口路由器',
      });
      await DevicePort.create({
        portId: generateId({ prefix: 'PORT' }),
        deviceId: deviceSwitch.deviceId,
        nicId: nic1.nicId,
        portName: 'GE0/0/2',
        portType: 'ethernet',
        portSpeed: '1000M',
        status: 'active',
        vlanId: 20,
        description: '下联服务器',
      });
      console.log(`网卡: ${nic1.name}, 端口: 2 个`);

      // ---------- 8. 业务 ----------
      const biz1 = await Business.create({
        businessId: generateId({ prefix: 'BIZ' }),
        name: '核心业务系统',
        description: '承载 ERP 与 OA 业务',
        status: 'active',
      });
      const biz2 = await Business.create({
        businessId: generateId({ prefix: 'BIZ' }),
        name: '数据仓库',
        description: 'BI 数据分析平台',
        status: 'active',
      });
      await DeviceBusiness.create({ deviceId: deviceServer1.deviceId, businessId: biz1.businessId, isPrimary: true });
      await DeviceBusiness.create({ deviceId: deviceServer2.deviceId, businessId: biz1.businessId, isPrimary: false });
      await DeviceBusiness.create({ deviceId: deviceServer2.deviceId, businessId: biz2.businessId, isPrimary: true });
      console.log(`业务: ${biz1.name}, ${biz2.name}`);

      // ---------- 9. 线缆 ----------
      await Cable.create({
        cableId: generateId({ prefix: 'CABLE' }),
        sourceDeviceId: deviceSwitch.deviceId,
        sourcePort: 'GE0/0/1',
        targetDeviceId: deviceRouter.deviceId,
        targetPort: 'GE0/0/0',
        cableType: '光纤',
        cableLength: 5,
        status: 'active',
        description: '核心交换机到出口路由器',
        cableLabel: 'FIB-001',
        cableColor: 'yellow',
        installedBy: '张三',
        installedAt: '2025-03-20',
        lastTestedAt: '2026-09-15',
      });
      await Cable.create({
        cableId: generateId({ prefix: 'CABLE' }),
        sourceDeviceId: deviceSwitch.deviceId,
        sourcePort: 'GE0/0/2',
        targetDeviceId: deviceServer1.deviceId,
        targetPort: 'eth0',
        cableType: '网线',
        cableLength: 3,
        status: 'active',
        description: '交换机到DB01',
        cableLabel: 'CAT6-001',
        cableColor: 'blue',
        installedBy: '李四',
        installedAt: '2025-03-20',
        lastTestedAt: '2026-09-15',
      });
      console.log(`线缆: 2 条`);

      // ---------- 10. 耗材分类 + 耗材 ----------
      const cat1 = await ConsumableCategory.create({
        name: '光纤跳线',
        description: '光纤连接耗材',
        sortOrder: 1,
        status: 'active',
      });
      const cat2 = await ConsumableCategory.create({
        name: '网线',
        description: '铜缆连接耗材',
        sortOrder: 2,
        status: 'active',
      });
      await Consumable.create({
        consumableId: generateId({ prefix: 'CONS' }),
        name: 'LC-LC 光纤跳线 3m',
        category: '光纤跳线',
        unit: '根',
        currentStock: 50,
        minStock: 10,
        maxStock: 200,
        unitPrice: 45,
        supplier: '华为原厂',
        location: '主备件仓库-A3',
        status: 'active',
        description: '单模光纤跳线',
      });
      await Consumable.create({
        consumableId: generateId({ prefix: 'CONS' }),
        name: 'Cat6 网线 2m',
        category: '网线',
        unit: '根',
        currentStock: 120,
        minStock: 30,
        maxStock: 300,
        unitPrice: 18,
        supplier: '安普六类',
        location: '主备件仓库-B2',
        status: 'active',
        description: '六类成品网线',
      });
      console.log(`耗材分类: ${cat1.name}, ${cat2.name}; 耗材: 2 条`);

      // ---------- 11. 测试普通用户 (viewer) ----------
      if (!(await exists(User, { username: 'testuser' }))) {
        const hashed = await bcrypt.hash('Test@123456', 10);
        const testUser = await User.create({
          userId: generateId({ prefix: 'USR' }),
          username: 'testuser',
          password: hashed,
          realName: '测试用户',
          status: 'active',
          email: 'testuser@example.com',
        });
        const viewerRole = await Role.findOne({ where: { roleCode: 'viewer' } });
        if (viewerRole) {
          await UserRole.create({ UserId: testUser.userId, RoleId: viewerRole.roleId });
        }
        console.log(`测试用户: testuser (viewer)`);
      }

      console.log('=== 测试数据生成完成 ===');
    } else {
      console.log('机房已存在，跳过（数据已就绪）');
    }
  } catch (e) {
    console.error('生成失败:', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
