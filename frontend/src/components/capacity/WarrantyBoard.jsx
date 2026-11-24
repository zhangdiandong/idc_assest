import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PALETTES } from './theme';

const WarrantyBoard = ({ warranty = {}, palette = PALETTES.dark }) => {
  const navigate = useNavigate();
  const rows = [
    { label: '≤30 天', value: warranty.d30 || 0, color: palette.rose },
    { label: '31-60 天', value: warranty.d60 || 0, color: palette.amber },
    { label: '61-90 天', value: warranty.d90 || 0, color: palette.cyan },
  ];
  const max = Math.max(...rows.map(row => row.value), 1);
  const within90 = warranty.within90 || 0;
  const expired = warranty.expired || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/devices')}
      onKeyDown={event => {
        if (event.key === 'Enter') navigate('/devices');
      }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 'clamp(30px, 2.4vw, 42px)',
            fontWeight: 700,
            lineHeight: 1,
            color: within90 > 0 ? palette.rose : palette.green,
            textShadow: palette.mode === 'dark' ? `0 0 20px ${palette.rose}55` : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {within90}
        </span>
        <span style={{ fontSize: 12, color: palette.textDim }}>台 · 90 天内到期</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(row => (
          <div key={row.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 5,
              }}
            >
              <span style={{ color: palette.textSecondary }}>{row.label}</span>
              <span style={{ color: row.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {row.value} 台
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: palette.track, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(row.value / max) * 100}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: `linear-gradient(90deg, ${row.color}55, ${row.color})`,
                  boxShadow: palette.mode === 'dark' ? `0 0 10px ${row.color}88` : 'none',
                  transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 10,
          borderTop: `1px dashed ${palette.borderSoft}`,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: palette.textDim,
        }}
      >
        <span style={{ color: expired > 0 ? palette.rose : palette.textDim }}>
          已过期 {expired} 台
        </span>
        <span>已录入 {warranty.total || 0} 台</span>
      </div>
    </div>
  );
};

export default WarrantyBoard;