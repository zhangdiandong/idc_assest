import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PALETTES } from './theme';

const TicketFaultBoard = ({ tickets = {}, palette = PALETTES.dark }) => {
  const navigate = useNavigate();
  const open = tickets.open || 0;
  const faultTop = tickets.faultTop || [];
  const maxFault = Math.max(...faultTop.map(item => item.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/tickets')}
        onKeyDown={event => {
          if (event.key === 'Enter') navigate('/tickets');
        }}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 'clamp(28px, 2.2vw, 38px)',
              fontWeight: 700,
              lineHeight: 1,
              color: open > 0 ? palette.amber : palette.green,
              textShadow: palette.mode === 'dark' ? `0 0 18px ${palette.amber}55` : 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {open}
          </span>
          <span style={{ fontSize: 12, color: palette.textDim }}>张未闭合工单</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: palette.textDim }}>
          <span>待处理 {tickets.pending || 0}</span>
          <span>处理中 {tickets.inProgress || 0}</span>
          <span style={{ color: palette.green }}>已关闭 {(tickets.closed || 0) + (tickets.completed || 0)}</span>
        </div>
      </div>

      <div
        style={{
          paddingTop: 10,
          borderTop: `1px dashed ${palette.borderSoft}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: palette.textSecondary }}>故障设备 TOP5</span>
        <span style={{ fontSize: 11, color: tickets.faultTotal > 0 ? palette.rose : palette.green }}>
          {tickets.faultTotal || 0} 台
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {faultTop.length ? (
          faultTop.map(item => (
            <div key={item.type}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: palette.text, fontWeight: 600 }}>{item.type}</span>
                <span style={{ color: palette.rose, fontWeight: 700 }}>{item.count}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: palette.track, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(item.count / maxFault) * 100}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${palette.rose}55, ${palette.rose})`,
                    boxShadow: palette.mode === 'dark' ? `0 0 8px ${palette.rose}77` : 'none',
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  color: palette.textDim,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.names.join(' · ')}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: palette.green }}>
            无故障设备
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketFaultBoard;