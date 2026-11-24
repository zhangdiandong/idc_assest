import React from 'react';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PALETTES, toneColor } from './theme';

const WarningList = ({ warnings = [], palette = PALETTES.dark }) => {
  const navigate = useNavigate();

  if (!warnings.length) {
    return (
      <div style={{ padding: '34px 0', textAlign: 'center' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: palette.green,
            boxShadow: palette.mode === 'dark' ? `0 0 14px ${palette.green}` : 'none',
            margin: '0 auto 10px',
            animation: 'capacityPulse 2s ease-in-out infinite',
          }}
        />
        <div style={{ fontSize: 13, color: palette.green }}>容量充裕，暂无预警</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {warnings.map((warning, index) => {
        const color = toneColor(palette, warning.level);
        return (
          <div
            key={`${warning.type}-${warning.title}-${index}`}
            role="button"
            tabIndex={0}
            onClick={() => warning.link && navigate(warning.link)}
            onKeyDown={event => {
              if (event.key === 'Enter' && warning.link) navigate(warning.link);
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 11px',
              borderRadius: 10,
              background:
                palette.mode === 'dark'
                  ? `linear-gradient(90deg, ${color}18 0%, rgba(148, 163, 184, 0.05) 100%)`
                  : `${color}0f`,
              border: `1px solid ${color}44`,
              borderLeft: `3px solid ${color}`,
              boxShadow: palette.mode === 'dark' ? `0 0 16px ${color}18` : 'none',
              cursor: warning.link ? 'pointer' : 'default',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: color,
                boxShadow: palette.mode === 'dark' ? `0 0 9px ${color}` : 'none',
                marginTop: 5,
                flexShrink: 0,
                animation: warning.level === 'danger' ? 'capacityPulse 1.6s ease-in-out infinite' : 'none',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: palette.text, marginBottom: 2 }}>
                {warning.title}
              </div>
              <div style={{ fontSize: 12, color: palette.textSecondary }}>{warning.description}</div>
            </div>
            {warning.link ? (
              <RightOutlined style={{ fontSize: 10, color, marginTop: 6 }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default WarningList;