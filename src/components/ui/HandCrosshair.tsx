import { useEffect, useRef } from 'react';

interface HandCrosshairProps {
  isEnabled: boolean;
  pointerRef: React.MutableRefObject<{ x: number; y: number; active: boolean; isTapTracking: boolean }>;
  hoverRef: React.MutableRefObject<boolean>;
}

export function HandCrosshair({ isEnabled, pointerRef, hoverRef }: HandCrosshairProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastActiveRef = useRef<boolean>(false);
  const lastStateRef = useRef<'NORMAL' | 'HOVER' | 'LOCKED' | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      if (containerRef.current) {
        containerRef.current.style.opacity = '0';
        containerRef.current.style.visibility = 'hidden';
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Force visible but opacity 0 initially so it can fade in
    if (containerRef.current) {
      containerRef.current.style.visibility = 'visible';
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      if (!containerRef.current || !textRef.current) return;

      const p = pointerRef.current;
      
      if (p.active) {
        if (!lastActiveRef.current) {
          containerRef.current.style.opacity = '1';
          lastActiveRef.current = true;
        }

        // Screen space mapping (MediaPipe normalized to CSS pixels)
        const screenX = p.x * window.innerWidth;
        const screenY = p.y * window.innerHeight;
        
        containerRef.current.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
        const isHovering = hoverRef.current;
        const isLocked = p.isTapTracking;
        
        const currentState = isLocked ? 'LOCKED' : (isHovering ? 'HOVER' : 'NORMAL');

        if (currentState !== lastStateRef.current) {
          if (currentState === 'LOCKED') {
            textRef.current.innerHTML = `⊕<br/><span style="font-size: 14px; margin-top: -8px; display: block;">🟠</span>`;
            textRef.current.style.color = '#f97316';
            textRef.current.style.textShadow = '0 0 8px rgba(249, 115, 22, 0.8)';
          } else if (currentState === 'HOVER') {
            textRef.current.innerHTML = '⊙';
            textRef.current.style.color = '#22d3ee';
            textRef.current.style.textShadow = '0 0 8px rgba(34, 211, 238, 0.8)';
          } else {
            textRef.current.innerHTML = '+';
            textRef.current.style.color = '#22d3ee';
            textRef.current.style.textShadow = '0 0 8px rgba(34, 211, 238, 0.8)';
          }
          lastStateRef.current = currentState;
        }
      } else {
        if (lastActiveRef.current) {
          containerRef.current.style.opacity = '0';
          lastActiveRef.current = false;
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isEnabled, pointerRef, hoverRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '32px',
        height: '32px',
        marginLeft: '-16px',
        marginTop: '-16px',
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#22d3ee',
        textShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
        fontSize: '28px',
        fontWeight: 300,
        opacity: 0,
        visibility: 'hidden',
        transition: 'opacity 0.2s ease-out, visibility 0.2s',
      }}
    >
      <span ref={textRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'color 0.2s' }}>+</span>
    </div>
  );
}
