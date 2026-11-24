import React from 'react';
import { PALETTES } from './theme';

const WIDTH = 820;
const HEIGHT = 250;
const PADDING = { top: 20, right: 22, bottom: 30, left: 46 };

const CapacityTrendChart = ({
  points = [],
  totalU = 0,
  warnUsage = 80,
  unit = 'U',
  palette = PALETTES.dark,
}) => {
  if (!points.length) {
    return (
      <div style={{ padding: '36px 0', textAlign: 'center', color: palette.textDim, fontSize: 13 }}>
        暂无趋势数据
      </div>
    );
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const values = points.map(item => Number(item.value) || 0);
  const warnValue = totalU > 0 ? (totalU * warnUsage) / 100 : 0;
  const rawMax = Math.max(...values, warnValue, 1);
  const rawMin = Math.min(...values);
  const max = rawMax + Math.max((rawMax - rawMin) * 0.18, 1);
  const min = Math.max(rawMin - Math.max((rawMax - rawMin) * 0.18, 1), 0);

  const xOf = index =>
    PADDING.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const yOf = value =>
    PADDING.top + innerHeight - ((value - min) / Math.max(max - min, 1)) * innerHeight;

  const linePath = points
    .map((item, index) => `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(item.value)}`)
    .join(' ');
  const areaPath = `${linePath} L${xOf(points.length - 1)},${PADDING.top + innerHeight} L${xOf(0)},${
    PADDING.top + innerHeight
  } Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: PADDING.top + innerHeight * ratio,
    value: Math.round(max - (max - min) * ratio),
  }));

  const labelStep = Math.max(Math.ceil(points.length / 8), 1);
  const lastPoint = points[points.length - 1];
  const growth = lastPoint ? lastPoint.value - values[0] : 0;
  const gradientId = `capacity-trend-${palette.mode}`;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="容量趋势图"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.cyan} stopOpacity="0.32" />
            <stop offset="55%" stopColor={palette.indigo} stopOpacity="0.12" />
            <stop offset="100%" stopColor={palette.indigo} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={palette.indigo} />
            <stop offset="55%" stopColor={palette.cyan} />
            <stop offset="100%" stopColor={palette.violet} />
          </linearGradient>
        </defs>

        {gridLines.map(line => (
          <g key={line.y}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={line.y}
              y2={line.y}
              stroke={palette.borderSoft}
              strokeDasharray="2 5"
            />
            <text
              x={PADDING.left - 8}
              y={line.y + 4}
              textAnchor="end"
              fontSize={10}
              fill={palette.textDim}
            >
              {line.value}
            </text>
          </g>
        ))}

        {warnValue > 0 && warnValue >= min && warnValue <= max ? (
          <g>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={yOf(warnValue)}
              y2={yOf(warnValue)}
              stroke={palette.amber}
              strokeWidth={1.2}
              strokeDasharray="7 6"
              opacity={0.8}
            />
            <text
              x={WIDTH - PADDING.right}
              y={yOf(warnValue) - 8}
              textAnchor="end"
              fontSize={10}
              fill={palette.amber}
            >
              警戒 {warnUsage}%
            </text>
          </g>
        ) : null}

        <path d={areaPath} fill={`url(#${gradientId}-area)`} />
        {palette.mode === 'dark' ? (
          <path
            d={linePath}
            fill="none"
            stroke={palette.cyan}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.28}
            style={{ filter: 'blur(6px)' }}
          />
        ) : null}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${gradientId}-line)`}
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((item, index) => {
          if (!(index === points.length - 1 || index % labelStep === 0)) return null;
          return (
            <text
              key={`${item.date}-${index}`}
              x={xOf(index)}
              y={HEIGHT - 9}
              textAnchor="middle"
              fontSize={10}
              fill={palette.textDim}
            >
              {item.date}
            </text>
          );
        })}

        <circle
          cx={xOf(points.length - 1)}
          cy={yOf(lastPoint.value)}
          r={9}
          fill={palette.cyan}
          opacity={0.18}
        />
        <circle
          cx={xOf(points.length - 1)}
          cy={yOf(lastPoint.value)}
          r={3.5}
          fill={palette.screen}
          stroke={palette.cyan}
          strokeWidth={2.4}
        />
      </svg>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 2,
          fontSize: 12,
          color: palette.textDim,
        }}
      >
        <span>
          当前 <b style={{ color: palette.cyan }}>{lastPoint ? lastPoint.value : 0}</b> {unit}
        </span>
        <span style={{ color: growth > 0 ? palette.amber : palette.green, fontWeight: 600 }}>
          区间变化 {growth > 0 ? '+' : ''}
          {growth} {unit}
        </span>
      </div>
    </div>
  );
};

export default CapacityTrendChart;