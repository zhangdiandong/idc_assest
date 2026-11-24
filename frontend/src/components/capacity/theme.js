export const PALETTES = {
  dark: {
    mode: 'dark',
    screen: '#050913',
    panelBg: 'linear-gradient(160deg, rgba(20, 29, 58, 0.92) 0%, rgba(8, 13, 28, 0.88) 100%)',
    panelShadow: '0 10px 30px rgba(2, 6, 18, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    border: 'rgba(99, 102, 241, 0.28)',
    borderSoft: 'rgba(148, 163, 184, 0.14)',
    track: 'rgba(148, 163, 184, 0.14)',
    text: '#e8efff',
    textSecondary: '#93a7cc',
    textDim: '#5f7195',
    cyan: '#22d3ee',
    indigo: '#818cf8',
    violet: '#c084fc',
    green: '#34d399',
    amber: '#fbbf24',
    rose: '#fb7185',
    titleGradient: 'linear-gradient(90deg, #e8efff 0%, #22d3ee 50%, #818cf8 100%)',
  },
  light: {
    mode: 'light',
    screen: '#f3f6ff',
    panelBg: 'linear-gradient(160deg, #ffffff 0%, #f5f8ff 100%)',
    panelShadow: '0 10px 26px rgba(53, 76, 148, 0.10), inset 0 1px 0 #ffffff',
    border: 'rgba(99, 102, 241, 0.22)',
    borderSoft: 'rgba(148, 163, 184, 0.35)',
    track: 'rgba(148, 163, 184, 0.24)',
    text: '#1e293b',
    textSecondary: '#475569',
    textDim: '#8296b5',
    cyan: '#0891b2',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    green: '#059669',
    amber: '#d97706',
    rose: '#dc2626',
    titleGradient: 'linear-gradient(90deg, #1e293b 0%, #4f46e5 55%, #0891b2 100%)',
  },
};

export const toneColor = (palette, tone) => {
  const map = {
    normal: palette.cyan,
    success: palette.green,
    warning: palette.amber,
    danger: palette.rose,
  };
  return map[tone] || palette.cyan;
};

export const toneOf = (usage, warn = 80, danger = 90) => {
  if (usage >= danger) return 'danger';
  if (usage >= warn) return 'warning';
  return 'normal';
};

export const panelStyle = (palette, accent) => ({
  position: 'relative',
  height: '100%',
  background: palette.panelBg,
  border: `1px solid ${accent ? `${accent}55` : palette.border}`,
  borderRadius: 16,
  boxShadow: accent
    ? `0 10px 28px rgba(2, 6, 18, 0.18), 0 0 22px ${accent}22, inset 0 1px 0 rgba(255, 255, 255, 0.04)`
    : palette.panelShadow,
  backdropFilter: 'blur(8px)',
  overflow: 'hidden',
});