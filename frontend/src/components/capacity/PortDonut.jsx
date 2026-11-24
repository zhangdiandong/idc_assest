import React from 'react';
import { PALETTES } from './theme';

const PortDonut = ({ byType = [], total = 0, usage = 0, palette = PALETTES.dark }) => {
  const data = byType.filter(item => item.total > 0);
  if (!data.length || total === 0) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', color: palette.textDim, fontSize: 13 }}>
        暂无端口数据
      </div>
    );
  }

  const colors = [
    palette.cyan,
    palette.indigo,
    palette.violet,
    palette.green,
    palette.amber,
    palette.rose,
    '#64748b',
  ];

  const top = data.slice(0, 6);
  const rest = data.slice(6).reduce((sum, item) => sum + item.total, 0);
  const slices = rest > 0 ? [...top, { type: '其他', total: rest }] : top;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={150} height={150} viewBox="0 0 150 150" aria-label="端口类型分布">
        <circle
          cx={75}
          cy={75}
          r={radius}
          fill="none"
          stroke={palette.track}
          strokeWidth={16}
        />
        {slices.map((item, index) => {
          const dash = (item.total / total) * circumference;
          const color = colors[index % colors.length];
          const element = (
            <circle
              key={item.type}
              cx={75}
              cy={75}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 75 75)"
              style={{ filter: palette.mode === 'dark' ? `drop-shadow(0 0 6px ${color}88)` : 'none' }}
            />
          );
          offset += dash;
          return element;
        })}
        <text
          x={75}
          y={68}
          textAnchor="middle"
          fontSize={24}
          fontWeight={700}
          fill={palette.cyan}
        >
          {usage}%
        </text>
        <text x={75} y={88} textAnchor="middle" fontSize={11} fill={palette.textDim}>
          占用率
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 130 }}>
        {slices.map((item, index) => {
          const color = colors[index % colors.length];
          return (
            <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: palette.mode === 'dark' ? `0 0 8px ${color}` : 'none',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: palette.textSecondary, flex: 1 }}>{item.type}</span>
              <span style={{ color: palette.text, fontWeight: 600 }}>{item.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortDonut;