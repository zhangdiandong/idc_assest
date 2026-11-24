import React, {
  Suspense,
  useMemo,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
const envMapUrl = '/assets/3d/env.hdr';
import RackModel from './RackModel';
import {
  useDevices,
  useSelectedDevice,
  useDeviceSlideEnabled,
  useViewMode,
  useDevicesByRack,
  useSelectedRack,
  useRacks,
} from '../../stores/scene3DStore';
import * as THREE from 'three';
import ErrorBoundary from '../ErrorBoundary';

// 检测是否为移动设备
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
// 检测是否为小屏幕
const isSmallScreen = window.innerWidth < 768;
// 移动端或小屏幕使用 dpr=1，桌面端使用 dpr=[1, 2] 提升清晰度
const deviceDpr = isMobile || isSmallScreen ? 1 : [1, 2];

// 创建全局 ref 用于外部访问 controls
const controlsRefGlobal = { current: null };

/**
 * 计算机柜相关的3D场景参数（统一一份计算，避免Controls和Scene不一致）
 * RackModel 中：最外层 group y=0.5，机柜框架高度 = rackHeight*0.04445 + 0.2（含上下板）
 * 因此机柜中心 y = 0.5 + (rackHeight*0.04445 + 0.2) / 2
 */
/**
 * 计算机柜相关的3D场景参数（统一一份计算，避免Controls和Scene不一致）
 * RackModel 中：最外层 group y=0.5，机柜框架高度 = rackHeight*0.04445 + 0.2（含上下板）
 * 因此机柜中心 y = 0.5 + (rackHeight*0.04445 + 0.2) / 2
 */
const getRackSceneParams = (rack) => {
  const rackHeight = rack?.height || 45;
  const uHeight = 0.04445;
  const rackHeightMeters = rackHeight * uHeight;
  const rackTotalHeight = rackHeightMeters + 0.2;
  const targetY = 0.5 + rackTotalHeight / 2;
  const distance = Math.max(3, rackTotalHeight * 1.3);
  // 相机与target同高，避免俯视导致的透视偏移（放大时机柜上跑）
  const cameraPosition = new THREE.Vector3(distance * 0.6, targetY, distance);
  const target = new THREE.Vector3(0, targetY, 0);
  const minDistance = Math.max(1.5, rackTotalHeight * 0.3);
  const maxDistance = Math.max(8, rackTotalHeight * 2);

  return { rackHeight, rackTotalHeight, targetY, distance, cameraPosition, target, minDistance, maxDistance };
};

/**
 * 计算整机房多机柜场景参数
 * 将机房内所有机柜按 colPos/rowPos 排布，相机对准整体中心
 */
const getRoomSceneParams = (racks) => {
  if (!racks || racks.length === 0) {
    return getRackSceneParams({ height: 42 });
  }
  const uHeight = 0.04445;
  const maxRackHeight = Math.max(...racks.map(r => r.height || 42));
  const rackTotalHeight = maxRackHeight * uHeight + 0.2;
  const targetY = 0.5 + rackTotalHeight / 2;

  // 机柜横向间距（机柜宽0.6 + 间隔0.9）
  const rackSpacingX = 1.6;
  const rackSpacingZ = 2.0;
  // 计算整体包围盒中心
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  racks.forEach(r => {
    // colPos/rowPos 以 0 为起始列行，不能用 || 兜底（0 会被误判为假值导致与第 1 列重叠）
    const col = Number.isInteger(r.colPos) ? r.colPos : 0;
    const row = Number.isInteger(r.rowPos) ? r.rowPos : 0;
    const x = col * rackSpacingX;
    const z = row * rackSpacingZ;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = Math.max(1, maxX - minX + 0.6);
  const depth = Math.max(1, maxZ - minZ + 1.0);
  const maxSpan = Math.max(width, depth, rackTotalHeight);

  const distance = Math.max(4, maxSpan * 1.4);
  const cameraPosition = new THREE.Vector3(centerX + distance * 0.5, targetY + rackTotalHeight * 0.4, centerZ + distance);
  const target = new THREE.Vector3(centerX, targetY, centerZ);
  const minDistance = Math.max(1.5, rackTotalHeight * 0.4);
  const maxDistance = Math.max(10, maxSpan * 3);

  return { rackTotalHeight, targetY, distance, cameraPosition, target, minDistance, maxDistance };
};

/**
 * 计算机房聚焦机柜场景参数
 * 整机房模式下点击选中某机柜后，相机突前放大聚焦到该机柜（效果参考单机柜展示）
 * 基础参数沿用 getRackSceneParams，但将相机 target/cameraPosition 平移到
 * 该机柜在世界坐标中的实际位置（由 colPos/rowPos 决定）
 */
const getFocusRackSceneParams = (focusRack) => {
  const base = getRackSceneParams(focusRack);
  const rackSpacingX = 1.6;
  const rackSpacingZ = 2.0;
  const col = Number.isInteger(focusRack?.colPos) ? focusRack.colPos : 0;
  const row = Number.isInteger(focusRack?.rowPos) ? focusRack.rowPos : 0;
  const worldX = col * rackSpacingX;
  const worldZ = row * rackSpacingZ;

  const cameraPosition = base.cameraPosition.clone().add(new THREE.Vector3(worldX, 0, worldZ));
  const target = base.target.clone().add(new THREE.Vector3(worldX, 0, worldZ));

  return { ...base, cameraPosition, target };
};

/**
 * 相机初始化组件：在 OrbitControls 接管前，确保相机朝向 target
 * 避免 OrbitControls 以默认方向初始化导致内部状态不一致
 */
const CameraInitializer = ({ cameraPosition, target }) => {
  const { camera } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    camera.position.copy(cameraPosition);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, cameraPosition, target]);

  return null;
};

// 内部组件用于处理 OrbitControls
const Controls = ({ rack, roomRacks, focusRack, onControlsReady, modalsOpen = false }) => {
  const controlsRef = useRef();
  const { camera } = useThree();
  const params = useMemo(() => {
    // 整机房模式下聚焦某机柜：用聚焦机柜的相机参数
    if (focusRack) return getFocusRackSceneParams(focusRack);
    if (roomRacks && roomRacks.length > 1) return getRoomSceneParams(roomRacks);
    return getRackSceneParams(rack);
  }, [rack, roomRacks, focusRack]);
  const { cameraPosition, target, minDistance, maxDistance } = params;

  // target 数组形式，用于 OrbitControls 的 target prop
  const targetArray = useMemo(() => [target.x, target.y, target.z], [target]);

  // 稳定 mouseButtons/touches 引用，避免每次渲染创建新对象导致 OrbitControls 重绑事件
  // 鼠标按键映射（THREE.MOUSE 常量：0=ROTATE 旋转, 1=DOLLY 缩放, 2=PAN 平移）
  // 优化：中键改为平移，解决放大后底部 U 位超出视野无法查看的问题
  //   - 左键：旋转视角（最常用操作）
  //   - 中键：平移视图（拖拽查看机柜上下细节，如底部 U 位）
  //   - 右键：缩放（替代原中键缩放，保留缩放能力）
  const mouseButtons = useMemo(
    () => ({
      LEFT: 0, // 左键旋转
      MIDDLE: 2, // 中键平移（拖拽查看底部 U 位等细节）
      RIGHT: 1, // 右键缩放
    }),
    []
  );
  const touches = useMemo(
    () => ({
      ONE: 1,
      TWO: 2,
    }),
    []
  );

  // 初始化时确保相机位置和朝向正确
  useEffect(() => {
    camera.position.copy(cameraPosition);
    camera.lookAt(target);
  }, [camera, cameraPosition, target]);

  // 注册 controls 就绪回调
  useEffect(() => {
    if (controlsRef.current) {
      controlsRefGlobal.current = controlsRef.current;
      if (onControlsReady) {
        onControlsReady({
          reset: () => {
            camera.position.copy(cameraPosition);
            controlsRef.current.target.copy(target);
            controlsRef.current.update();
          },
        });
      }
    }
  }, [controlsRef.current, camera, cameraPosition, target, onControlsReady]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={targetArray}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      minDistance={minDistance}
      maxDistance={maxDistance}
      // 模态框打开时禁用所有交互，避免误拖动视角
      enablePan={!modalsOpen}
      enableZoom={!modalsOpen}
      enableRotate={!modalsOpen}
      mouseButtons={mouseButtons}
      touches={touches}
    />
  );
};

/**
 * 场景地板组件：半透明面板 + 网格线
 * 提供空间参考，增强机柜放置的真实感
 */
const Floor = ({ racks = [], viewMode = 'single' }) => {
  const uHeight = 0.04445;
  const rackSpacingX = 1.6;
  const rackSpacingZ = 2.0;

  // 根据机房机柜分布计算地板范围
  const { centerX, centerZ, floorSize, panelColor, gridColor } = useMemo(() => {
    if (viewMode === 'room' && racks.length > 1) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      racks.forEach(r => {
        const col = Number.isInteger(r.colPos) ? r.colPos : 0;
        const row = Number.isInteger(r.rowPos) ? r.rowPos : 0;
        const x = col * rackSpacingX;
        const z = row * rackSpacingZ;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      });
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const size = Math.max(maxX - minX, maxZ - minZ, 4) + 4;
      return { centerX: cx, centerZ: cz, floorSize: size, panelColor: '#f1f5f9', gridColor: '#cbd5e1' };
    }
    // 单机柜：以小范围地板为主
    return { centerX: 0, centerZ: 0, floorSize: 4, panelColor: '#f1f5f9', gridColor: '#cbd5e1' };
  }, [racks, viewMode, rackSpacingX, rackSpacingZ]);

  return (
    <group>
      {/* 半透明面板 */}
      <mesh position={[centerX, -0.01, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial
          color={panelColor}
          transparent
          opacity={0.85}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      {/* 网格线 */}
      <gridHelper
        args={[floorSize, Math.max(8, Math.round(floorSize)), gridColor, gridColor]}
        position={[centerX, 0, centerZ]}
      />
      {/* 边缘描边 */}
      <mesh position={[centerX, -0.005, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.35} side={2} />
      </mesh>
    </group>
  );
};

const Scene = forwardRef(
  ({ rack, tooltipFields, onDeviceClick, onDeviceHover, onDeviceLeave, onRackClick, focusRack = null, onBackgroundClick, modalsOpen = false }, ref) => {
    // 从 Context 获取3D场景状态（使用 selector 精准订阅，避免全量订阅导致过度渲染）
    const devices = useDevices();
    const selectedDevice = useSelectedDevice();
    const deviceSlideEnabled = useDeviceSlideEnabled();
    const viewMode = useViewMode();
    const devicesByRack = useDevicesByRack();
    const selectedRack = useSelectedRack();
    const racks = useRacks();

    // 整机房视图下，计算该机房的所有机柜
    const roomRacks = useMemo(() => {
      if (viewMode !== 'room' || !selectedRack) return [];
      const roomId = selectedRack.roomId || selectedRack.Room?.roomId;
      if (!roomId) return [];
      return racks.filter(r => {
        const rRoomId = r.roomId || r.Room?.roomId;
        return rRoomId === roomId;
      });
    }, [viewMode, selectedRack, racks]);

    // 用于存储 controls API
    const controlsApiRef = useRef(null);

    // 使用 useImperativeHandle 暴露重置方法给父组件
    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (controlsApiRef.current) {
          controlsApiRef.current.reset();
        }
      },
    }));

    // 使用 useMemo 稳定 props 引用
    // 修复 #13：依赖项使用 selectedDevice?.id 而非 selectedDevice 对象，
    // 避免 store 重新创建 selectedDevice 对象但 id 未变时触发无效重渲染
    const rackModelProps = useMemo(
      () => ({
        rack,
        devices,
        selectedDeviceId: selectedDevice?.id,
        onDeviceClick,
        onDeviceLeave,
        onDeviceHover,
        tooltipFields,
        deviceSlideEnabled,
        onRackClick,
      }),
      [
        rack,
        devices,
        selectedDevice?.id,
        onDeviceClick,
        onDeviceLeave,
        onDeviceHover,
        tooltipFields,
        deviceSlideEnabled,
        onRackClick,
      ]
    );

    // 整机房视图：为每个机柜构建 props
    const roomRackModelProps = useMemo(() => {
      if (viewMode !== 'room') return [];
      return roomRacks.map(r => {
        const rDevices = devicesByRack[r.rackId] || [];
        const isFocus = focusRack?.rackId === r.rackId;
        return {
          rack: r,
          devices: rDevices,
          selectedDeviceId: selectedDevice?.id,
          onDeviceClick,
          onDeviceLeave,
          onDeviceHover,
          tooltipFields,
          deviceSlideEnabled,
          onRackClick,
          isSelected: selectedRack?.rackId === r.rackId,
          // 聚焦模式下非聚焦机柜淡化（半透明）
          isFocusDimmed: !!focusRack && !isFocus,
        };
      });
    }, [viewMode, roomRacks, devicesByRack, selectedDevice?.id, onDeviceClick, onDeviceLeave, onDeviceHover, tooltipFields, deviceSlideEnabled, onRackClick, selectedRack, focusRack]);

    // 整机房模式下聚焦某机柜：相机突前放大到该机柜（效果参考单机柜展示）
    const params = useMemo(() => {
      if (viewMode === 'room' && focusRack) return getFocusRackSceneParams(focusRack);
      if (viewMode === 'room' && roomRacks.length > 1) return getRoomSceneParams(roomRacks);
      return getRackSceneParams(rack);
    }, [viewMode, roomRacks, rack, focusRack]);
    const cameraPosition = useMemo(
      () => [params.cameraPosition.x, params.cameraPosition.y, params.cameraPosition.z],
      [params]
    );

    return (
      <ErrorBoundary
        fullPage={false}
        title="3D 场景渲染失败"
        subTitle="3D 场景在渲染过程中遇到错误，请检查浏览器是否支持 WebGL"
      >
        <Canvas
          dpr={deviceDpr}
          // 禁用 R3F 自适应性能降级
          // 原因：放大时 LOD 切换 + DeviceModel 挂载导致瞬时帧率下跌，
          // R3F 会把 dpr 从 2 降到 0.5，Canvas 渲染分辨率骤降到 1/4，
          // 画面出现"大黑块"闪烁，几帧后 dpr 恢复才变正常
          gl={{
            antialias: true, // 对所有设备开启抗锯齿提升清晰度
            alpha: true, // 必须开启 alpha 以支持透明背景
            powerPreference: 'high-performance',
          }}
          style={{ background: 'transparent', touchAction: 'none' }}
          // 点击空白区域（非机柜/设备）退出聚焦模式：整机房下点击背景恢复全部机柜
          // 修复：原用 onClick 导致点击机柜时聚焦被立即清除（R3F mesh onClick 的
          // stopPropagation 只阻止 R3F 内部冒泡，不阻止 Canvas 的 DOM onClick）。
          // 改用 onPointerMissed：仅在射线未命中任何 mesh 时触发，点击机柜/设备不会触发。
          onPointerMissed={e => {
            if (viewMode === 'room' && onBackgroundClick) {
              onBackgroundClick();
            }
          }}
        >
          <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />

          {/* 相机初始化：确保 OrbitControls 接管前相机朝向正确 */}
          <CameraInitializer cameraPosition={params.cameraPosition} target={params.target} />

          <ambientLight intensity={0.5} color="#ffffff" />
          <pointLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
          {/* 修复 #12：移除 castShadow 及 shadow 配置
              原因：场景中所有 mesh 均未设置 castShadow/receiveShadow，开启 shadow pass 只会浪费
              GPU 资源分配 512x512 深度纹理，且每帧执行 shadow map 渲染但不产生可见阴影。
              如需启用阴影，需同步在机柜框架、设备机身上添加 castShadow/receiveShadow 并启用 Canvas shadows */}
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {/* 地板：提供空间参考，增强机柜放置真实感 */}
          <Floor racks={viewMode === 'room' ? roomRacks : []} viewMode={viewMode} />

          <Suspense fallback={null}>
            <Environment files={envMapUrl} blur={0.5} resolution={256} background={false} />
          </Suspense>

          {/* Models */}
          {viewMode === 'room' && roomRackModelProps.length > 1 ? (
            <group position={[0, 0, 0]}>
              {roomRackModelProps.map((props, index) => {
                // 机柜位置：根据 colPos/rowPos 排布
                const col = Number.isInteger(props.rack.colPos) ? props.rack.colPos : 0;
                const row = Number.isInteger(props.rack.rowPos) ? props.rack.rowPos : 0;
                const rackSpacingX = 1.6;
                const rackSpacingZ = 2.0;
                // 聚焦模式下：只显示当前聚焦机柜，隐藏其他机柜
                // 需求：选中机柜后只显示当前机柜，效果参考单机柜展示
                const isFocus = focusRack?.rackId === props.rack.rackId;
                if (focusRack && !isFocus) {
                  // 聚焦模式下非聚焦机柜完全隐藏（不渲染）
                  return null;
                }
                return (
                  <group
                    key={props.rack.rackId || `rack-${index}`}
                    position={[col * rackSpacingX, 0, row * rackSpacingZ]}
                  >
                    <RackModel {...props} dimmed={false} />
                  </group>
                );
              })}
            </group>
          ) : (
            <group position={[0, 0, 0]}>
              <RackModel {...rackModelProps} />
            </group>
          )}

          {/* Controls - 使用独立组件保持旋转中心固定 */}
          <Controls
            rack={rack}
            roomRacks={viewMode === 'room' ? roomRacks : null}
            focusRack={viewMode === 'room' ? focusRack : null}
            modalsOpen={modalsOpen}
            onControlsReady={api => {
              controlsApiRef.current = api;
            }}
          />
        </Canvas>
      </ErrorBoundary>
    );
  }
);

export default Scene;
