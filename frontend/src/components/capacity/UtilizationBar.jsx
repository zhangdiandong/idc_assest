import React from 'react';
import { PALETTES, toneColor, toneOf } from './theme';

const UtilizationBar = ({ items = [], emptyText = '暂无机柜数据', onSelect, palette = PALETTES.dark }) => {
  if (!items.length) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', color: palette.textDim, fontSize: 13 }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {items.map((item, index) => {
        const color = toneColor(palette, toneOf(item.uUsage));
        const width = Math.min(Math.max(item.uUsage, 0), 100);

        return (
          <div
            key={item.rackId}
            role="button"
            tabIndex={0}
            onClick={() => onSelect && onSelect(item)}
            onKeyDown={event => {
              if (event.key === 'Enter' && onSelect) onSelect(item);
            }}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: index < 3 ? '#ffffff' : palette.textSecondary,
                  background: index < 3 ? color : palette.track,
                  boxShadow: index < 3 && palette.mode === 'dark' ? `0 0 10px ${color}66` : 'none',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <span style={{ color: palette.text, fontWeight: 600, flex: 1 }}>
                {item.name}
                {item.conflicts > 0 ? (
                  <span style={{ marginLeft: 6, color: palette.rose, fontSize: 11 }}>U位冲突</span>
                ) : null}
              </span>
              <span style={{ color: palette.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                {item.usedU}/{item.height}U
              </span>
              <span
                style={{
                  color,
                  fontWeight: 700,
                  width: 46,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.uUsage}%
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                height: 8,
                borderRadius: 99,
                background: palette.track,
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: `linear-gradient(90deg, ${palette.indigo}80 0%, ${color} 100%)`,
                  boxShadow: palette.mode === 'dark' ? `0 0 12px ${color}80` : `0 1px 3px ${color}55`,
                  transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '80%',
                  top: -3,
                  width: 1,
                  height: 14,
                  background: palette.amber,
                  opacity: 0.55,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UtilizationBar;