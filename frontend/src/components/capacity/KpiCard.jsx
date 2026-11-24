import React from 'react';
import { PALETTES, panelStyle, toneColor } from './theme';
import AnimatedValue from './AnimatedValue';

const KpiCard = ({
  icon: Icon,
  title,
  value,
  decimals = 0,
  unit,
  usage,
  extra,
  tone = 'normal',
  loading = false,
  onClick,
  delay = 0,
  palette = PALETTES.dark,
}) => {
  const color = toneColor(palette, tone);
  const percent = typeof usage === 'number' ? Math.min(Math.max(usage, 0), 100) : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' && onClick) onClick();
      }}
      style={{
        ...panelStyle(palette, color),
        padding: '16px 18px 14px',
        cursor: onClick ? 'pointer' : 'default',
        animation: `capacityRise 0.6s ease-out ${delay}s backwards`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: 0.85,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontSize: 16,
            background: `${color}1a`,
            border: `1px solid ${color}55`,
            boxShadow: palette.mode === 'dark' ? `0 0 14px ${color}33` : `0 2px 6px ${color}22`,
            flexShrink: 0,
          }}
        >
          {Icon ? <Icon /> : null}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: palette.textSecondary,
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 12 }}>
        <span
          style={{
            fontSize: 'clamp(26px, 2.4vw, 40px)',
            fontWeight: 700,
            lineHeight: 1,
            color,
            textShadow: palette.mode === 'dark' ? `0 0 18px ${color}66` : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '--' : <AnimatedValue value={value || 0} decimals={decimals} />}
        </span>
        {unit ? (
          <span style={{ fontSize: 12, color: palette.textDim, letterSpacing: 0.4 }}>{unit}</span>
        ) : null}
      </div>

      {percent !== null ? (
        <div
          style={{
            marginTop: 12,
            height: 4,
            borderRadius: 99,
            background: palette.track,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              borderRadius: 99,
              background: `linear-gradient(90deg, ${color}66 0%, ${color} 100%)`,
              boxShadow: palette.mode === 'dark' ? `0 0 10px ${color}99` : `0 1px 3px ${color}55`,
              transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      ) : null}

      {extra ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: palette.textDim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {extra}
        </div>
      ) : null}
    </div>
  );
};

export default KpiCard;