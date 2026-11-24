import React, { useEffect, useRef, useState } from 'react';

const AnimatedValue = ({ value = 0, decimals = 0, duration = 1200 }) => {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    startRef.current = null;

    const step = timestamp => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(target * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return <span>{display.toFixed(decimals)}</span>;
};

export default React.memo(AnimatedValue);