import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Select, Segmented, Button, Tooltip, ConfigProvider, theme as antdTheme, message } from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  PartitionOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { PALETTES, panelStyle, toneColor, toneOf } from '../components/capacity/theme';
import {
  KpiCard,
  UtilizationBar,
  PortDonut,
  CapacityTrendChart,
  WarningList,
  WarrantyBoard,
  TicketFaultBoard,
} from '../components/capacity';

const RANGE_OPTIONS = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
];

const THEME_OPTIONS = [
  { label: '深色', value: 'dark' },
  { label: '浅色', value: 'light' },
];

const decimalsOf = value => (Number.isInteger(Number(value)) ? 0 : 1);

const SCREEN_CSS = `
  .capacity-screen {
    margin: -24px;
    padding: 18px 24px 20px;
    height: calc(100vh - 64px);
    min-height: 760px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    transition: background 0.3s ease, color 0.3s ease;
  }
  .capacity-screen[data-theme='dark'] {
    background:
      radial-gradient(1200px 600px at 10% -12%, rgba(99, 102, 241, 0.24), transparent 60%),
      radial-gradient(900px 520px at 90% -4%, rgba(34, 211, 238, 0.16), transparent 62%),
      radial-gradient(700px 420px at 50% 110%, rgba(168, 85, 247, 0.12), transparent 65%),
      linear-gradient(rgba(99, 102, 241, 0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99, 102, 241, 0.055) 1px, transparent 1px),
      #050913;
    background-size: auto, auto, auto, 46px 46px, 46px 46px, auto;
    color: #e8efff;
  }
  .capacity-screen[data-theme='light'] {
    background:
      radial-gradient(1000px 520px at 8% -10%, rgba(99, 102, 241, 0.10), transparent 62%),
      radial-gradient(900px 520px at 92% -6%, rgba(34, 211, 238, 0.10), transparent 62%),
      linear-gradient(rgba(99, 102, 241, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99, 102, 241, 0.045) 1px, transparent 1px),
      #f3f6ff;
    background-size: auto, auto, 46px 46px, 46px 46px, auto;
    color: #1e293b;
  }
  .capacity-screen:fullscreen { padding: 26px 34px 30px; margin: 0; }
  .capacity-kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    flex: 0 0 auto;
  }
  .capacity-main-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-rows: minmax(0, 1fr);
    gap: 14px;
    margin-top: 14px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .capacity-span-5 { grid-column: span 5; }
  .capacity-span-4 { grid-column: span 4; }
  .capacity-span-3 { grid-column: span 3; }
  .capacity-span-2 { grid-column: span 2; }
  .capacity-span-8 { grid-column: span 8; }
  @media (max-width: 1500px) {
    .capacity-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 1200px) {
    .capacity-screen { height: auto; min-height: calc(100vh - 64px); overflow: visible; }
    .capacity-main-grid { grid-auto-rows: auto; }
    .capacity-span-5, .capacity-span-4, .capacity-span-3, .capacity-span-8 { grid-column: span 12; }
  }
  @media (max-width: 760px) {
    .capacity-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @keyframes capacityRise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes capacityPulse {
    0%, 100% { opacity: 0.35; transform: scale(0.9); }
    50% { opacity: 0.9; transform: scale(1.15); }
  }
  @keyframes capacityBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
  .capacity-panel-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; letter-spacing: 0.6px;
  }
  .capacity-panel-title::before {
    content: ''; width: 3px; height: 14px; border-radius: 2px;
    background: linear-gradient(180deg, #22d3ee, #818cf8);
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
  }
  .capacity-scroll::-webkit-scrollbar { width: 4px; }
  .capacity-scroll::-webkit-scrollbar-thumb { background: rgba(129, 140, 248, 0.4); border-radius: 4px; }

  .capacity-toolbar .ant-btn { box-shadow: none; font-weight: 500; }
  .capacity-toolbar .ant-btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #22d3ee 100%) !important;
    border: none !important;
    color: #ffffff !important;
    font-weight: 600;
  }
  .capacity-toolbar .ant-btn-primary:hover { filter: brightness(1.08); }
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-btn-default {
    background: rgba(148, 163, 184, 0.16) !important;
    border-color: rgba(129, 140, 248, 0.5) !important;
    color: #dbe6ff !important;
  }
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-btn-default:hover {
    border-color: #22d3ee !important;
    color: #ffffff !important;
  }
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-btn-default {
    background: #ffffff !important;
    border-color: #c7d2fe !important;
    color: #334155 !important;
  }
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-btn-default:hover {
    border-color: #6366f1 !important;
    color: #4f46e5 !important;
  }

  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-segmented {
    background: rgba(148, 163, 184, 0.16) !important;
    color: #c3d0ea;
  }
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-segmented-item { color: #c3d0ea; }
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-segmented-item:hover {
    color: #ffffff;
  }
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-segmented-item-selected,
  .capacity-screen[data-theme='dark'] .capacity-toolbar .ant-segmented-thumb {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(34, 211, 238, 0.8)) !important;
    color: #ffffff !important;
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.45);
  }
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-segmented {
    background: #e8edff !important;
    color: #475569;
  }
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-segmented-item { color: #475569; }
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-segmented-item-selected,
  .capacity-screen[data-theme='light'] .capacity-toolbar .ant-segmented-thumb {
    background: #ffffff !important;
    color: #4f46e5 !important;
    box-shadow: 0 1px 6px rgba(79, 70, 229, 0.24);
  }
`;

const Clock = ({ palette }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        color: palette.textSecondary,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <ClockCircleOutlined style={{ color: palette.cyan }} />
      {now.toLocaleTimeString('zh-CN', { hour12: false })}
    </div>
  );
};

const Panel = ({ title, accent, extra, children, className = '', delay = 0, palette }) => (
  <div
    className={className}
    style={{
      ...panelStyle(palette, accent),
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      animation: `capacityRise 0.6s ease-out ${delay}s backwards`,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8,
        flex: '0 0 auto',
      }}
    >
      <span className="capacity-panel-title" style={{ color: palette.text }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: palette.textDim }}>{extra}</span>
    </div>
    <div
      className="capacity-scroll"
      style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
    >
      {children}
    </div>
  </div>
);

const CapacityDashboard = () => {
  const screenRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [range, setRange] = useState(30);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('capacity-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [overview, setOverview] = useState(null);
  const [rackItems, setRackItems] = useState([]);
  const [trend, setTrend] = useState(null);
  const [ipPools, setIpPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const palette = PALETTES[themeMode] || PALETTES.dark;

  useEffect(() => {
    try {
      localStorage.setItem('capacity-theme', themeMode);
    } catch {
      // 忽略存储失败
    }
  }, [themeMode]);

  const loadData = useCallback(async (targetRoomId, targetRange, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const scopeParams = targetRoomId ? { roomId: targetRoomId } : {};
      const [overviewRes, racksRes, trendRes, ipRes] = await Promise.all([
        axios.get('/api/capacity/overview', { params: scopeParams }),
        axios.get('/api/capacity/racks', { params: { ...scopeParams, limit: 10 } }),
        axios.get('/api/capacity/trend', { params: { ...scopeParams, range: targetRange } }),
        axios.get('/api/capacity/ip-pools', { params: { limit: 6 } }),
      ]);

      setOverview(overviewRes.data);
      setRooms(overviewRes.data?.rooms || []);
      setRackItems(racksRes.data?.items || []);
      setTrend(trendRes.data);
      setIpPools(ipRes.data?.items || []);
    } catch (error) {
      message.error(error?.response?.data?.message || '加载容量数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(roomId, range);
  }, [loadData, roomId, range]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => loadData(roomId, range, true), 60000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData, roomId, range]);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      screenRef.current?.requestFullscreen?.();
    }
  };

  const u = overview?.u || {};
  const power = overview?.power || {};
  const port = overview?.port || {};
  const ip = overview?.ip || {};
  const consumable = overview?.consumable || {};
  const warranty = overview?.warranty || {};
  const tickets = overview?.tickets || {};
  const warnings = overview?.warnings || [];
  const dangerCount = warnings.filter(item => item.level === 'danger').length;

  return (
    <div ref={screenRef} className="capacity-screen" data-theme={themeMode}>
      <style>{SCREEN_CSS}</style>
      <ConfigProvider
        theme={{
          algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: palette.indigo,
            borderRadius: 10,
            colorBgContainer: themeMode === 'dark' ? 'rgba(13, 20, 42, 0.92)' : '#ffffff',
            colorBgElevated: themeMode === 'dark' ? '#0d142a' : '#ffffff',
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 16,
            flex: '0 0 auto',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: palette.green,
                  boxShadow: `0 0 12px ${palette.green}`,
                  animation: 'capacityBlink 2s ease-in-out infinite',
                }}
              />
              <h1
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 'clamp(20px, 1.8vw, 30px)',
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: palette.text,
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: '1em',
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #22d3ee, #818cf8)',
                    boxShadow: '0 0 12px rgba(34, 211, 238, 0.65)',
                  }}
                />
                数据中心容量指挥中心
              </h1>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: palette.textDim, letterSpacing: 1 }}>
              {overview?.scope?.roomName ? `${overview.scope.roomName} · ` : '全部机房 · '}
              {overview?.scope?.rackCount || 0} 机柜 / {overview?.scope?.deviceCount || 0} 在架设备 · 实时聚合
            </div>
          </div>

          <div
            className="capacity-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 3,
              flexShrink: 0,
            }}
          >
            <Clock palette={palette} />
            <Select
              value={roomId}
              onChange={setRoomId}
              style={{ width: 170 }}
              options={[
                { label: '全部机房', value: '' },
                ...rooms.map(room => ({ label: room.name, value: room.roomId })),
              ]}
            />
            <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <Tooltip title={autoRefresh ? '关闭自动刷新（60s）' : '开启自动刷新（60s）'}>
              <Button
                type={autoRefresh ? 'primary' : 'default'}
                onClick={() => setAutoRefresh(value => !value)}
                style={{ fontSize: 12 }}
              >
                {autoRefresh ? '自动刷新' : '手动刷新'}
              </Button>
            </Tooltip>
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined />} onClick={() => loadData(roomId, range, true)} loading={refreshing} />
            </Tooltip>
            <Tooltip title={isFullscreen ? '退出全屏' : '进入全屏'}>
              <Button
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={toggleFullscreen}
              />
            </Tooltip>
            <Segmented value={themeMode} onChange={setThemeMode} options={THEME_OPTIONS} />
          </div>
        </div>

        <div className="capacity-kpi-grid">
          <KpiCard
            icon={CloudServerOutlined}
            title="机柜 U 位"
            value={u.usage || 0}
            decimals={decimalsOf(u.usage)}
            unit="%"
            usage={u.usage || 0}
            tone={toneOf(u.usage || 0)}
            loading={loading}
            extra={`已用 ${u.used || 0}/${u.total || 0}U · 余 ${u.free || 0}U`}
            palette={palette}
          />
          <KpiCard
            icon={PartitionOutlined}
            title="端口占用"
            value={port.usage || 0}
            decimals={decimalsOf(port.usage)}
            unit="%"
            usage={port.usage || 0}
            tone={toneOf(port.usage || 0)}
            loading={loading}
            extra={`已用 ${port.occupied || 0}/${port.total || 0} · 故障 ${port.fault || 0}`}
            palette={palette}
            delay={0.05}
          />
          <KpiCard
            icon={ApiOutlined}
            title="IP 地址池"
            value={ip.usage || 0}
            decimals={decimalsOf(ip.usage)}
            unit="%"
            usage={ip.usage || 0}
            tone={toneOf(ip.usage || 0, 85, 95)}
            loading={loading}
            extra={`可用 ${Math.max((ip.usableHosts || 0) - (ip.used || 0), 0)} · 已用 ${ip.used || 0}`}
            palette={palette}
            delay={0.1}
          />
          <KpiCard
            icon={ThunderboltOutlined}
            title="机柜功耗"
            value={power.usage || 0}
            decimals={decimalsOf(power.usage)}
            unit="%"
            usage={power.usage || 0}
            tone={toneOf(power.usage || 0)}
            loading={loading}
            extra={`${power.used || 0}/${power.max || 0} kW`}
            palette={palette}
            delay={0.15}
          />
          <KpiCard
            icon={ShoppingCartOutlined}
            title="耗材周转"
            value={consumable.turnover || 0}
            decimals={2}
            unit="次/30天"
            tone={consumable.lowStockCount > 0 ? 'warning' : 'success'}
            loading={loading}
            extra={`低库存 ${consumable.lowStockCount || 0} 种 · 出库 ${consumable.out30 || 0}`}
            palette={palette}
            delay={0.2}
          />
          <KpiCard
            icon={WarningOutlined}
            title="容量预警"
            value={warnings.length}
            unit="项"
            tone={dangerCount > 0 ? 'danger' : warnings.length ? 'warning' : 'success'}
            loading={loading}
            extra={dangerCount > 0 ? `${dangerCount} 项严重` : '暂无严重预警'}
            palette={palette}
            delay={0.25}
          />
        </div>

        <div className="capacity-main-grid">
          <Panel
            className="capacity-span-5"
            title="机柜 U 位利用率 TOP 10"
            accent={palette.cyan}
            extra={<span style={{ color: palette.amber }}>80% 警戒</span>}
            delay={0.28}
            palette={palette}
          >
            <UtilizationBar items={rackItems} palette={palette} />
          </Panel>

          <Panel
            className="capacity-span-3"
            title="端口类型分布"
            accent={palette.violet}
            extra={port.scoped === false ? '全局统计' : '当前范围'}
            delay={0.32}
            palette={palette}
          >
            <PortDonut
              byType={port.byType || []}
              total={port.total || 0}
              usage={port.usage || 0}
              palette={palette}
            />
          </Panel>

          <Panel
            className="capacity-span-4"
            title="容量预警"
            accent={palette.rose}
            extra={`${warnings.length} 项`}
            delay={0.36}
            palette={palette}
          >
            <WarningList warnings={warnings} palette={palette} />
          </Panel>

          <Panel
            className="capacity-span-4"
            title="U 位占用趋势"
            accent={palette.indigo}
            extra={trend?.estimated ? '趋势为估算值' : '真实快照'}
            delay={0.4}
            palette={palette}
          >
            <CapacityTrendChart
              points={trend?.points || []}
              totalU={u.total || 0}
              warnUsage={80}
              palette={palette}
            />
          </Panel>

          <Panel
            className="capacity-span-3"
            title="保修到期"
            accent={palette.amber}
            extra={`${warranty.within90 || 0} 台 / 90 天`}
            delay={0.44}
            palette={palette}
          >
            <WarrantyBoard warranty={warranty} palette={palette} />
          </Panel>

          <Panel
            className="capacity-span-3"
            title="工单与故障"
            accent={palette.rose}
            extra={`未闭合 ${tickets.open || 0}`}
            delay={0.48}
            palette={palette}
          >
            <TicketFaultBoard tickets={tickets} palette={palette} />
          </Panel>

          <Panel
            className="capacity-span-2"
            title="IP 池 TOP 6"
            accent={palette.green}
            extra={<span style={{ color: palette.green }}>85%</span>}
            delay={0.52}
            palette={palette}
          >
            {ipPools.length ? (
              <div
                className="capacity-scroll"
                style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto' }}
              >
                {ipPools.map(pool => {
                  const color = toneColor(palette, toneOf(pool.usage, 85, 95));
                  return (
                    <div key={pool.subnetId}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          marginBottom: 5,
                          gap: 8,
                        }}
                      >
                        <span style={{ color: palette.text, fontWeight: 600 }}>{pool.name}</span>
                        <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                          {pool.used}/{pool.usableHosts || pool.used + pool.free} · {pool.usage}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: palette.track,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(pool.usage, 100)}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: `linear-gradient(90deg, ${color}66, ${color})`,
                            boxShadow: palette.mode === 'dark' ? `0 0 10px ${color}88` : 'none',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: palette.textDim }}>
                        {pool.cidr}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '28px 0', textAlign: 'center', color: palette.textDim, fontSize: 12 }}>
                暂无网段数据
              </div>
            )}
          </Panel>
        </div>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: palette.textDim,
            letterSpacing: 0.5,
            flex: '0 0 auto',
          }}
        >
          <span>数据源：本地实时聚合 · 每 60s 自动刷新</span>
          <span>
            最后更新 {overview?.updatedAt ? new Date(overview.updatedAt).toLocaleString('zh-CN') : '-'}
          </span>
        </div>
      </ConfigProvider>
    </div>
  );
};

export default CapacityDashboard;