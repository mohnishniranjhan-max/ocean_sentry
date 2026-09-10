import { useState, useEffect, useRef } from 'react';
import type { BlowDetectorState } from '../gestures/gestureTypes';

interface GestureIndicatorProps {
  isEnabled: boolean;
  faceDetected: boolean;
  detectorState: BlowDetectorState;
  blowScore: number;
  timeSinceBlow1: number;
}

export function GestureIndicator({
  isEnabled,
  faceDetected,
  detectorState,
  blowScore,
  timeSinceBlow1,
}: GestureIndicatorProps) {
  const [showPulse, setShowPulse] = useState(false);
  const [statusText, setStatusText] = useState('');
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setStatusText('');
      return;
    }

    switch (detectorState) {
      case 'BLOW_CANDIDATE':
        setStatusText('DETECTING...');
        break;
      case 'BLOW_1_CONFIRMED':
      case 'WAITING_FOR_BLOW_2':
        setStatusText('BLOW 1 / 2');
        setShowPulse(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setShowPulse(false), 600);
        break;
      case 'BLOW_2_CANDIDATE':
        setStatusText('BLOW 2...');
        break;
      case 'BLOW_BLOW_CONFIRMED':
        setStatusText('BLOW-BLOW');
        setShowPulse(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => {
          setShowPulse(false);
          setStatusText('TRANSITION');
        }, 400);
        break;
      case 'COOLDOWN':
        setStatusText('COOLDOWN');
        break;
      default:
        setStatusText('');
    }
  }, [detectorState, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
        pointerEvents: 'none',
      }}
    >
      {/* Tracking status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(2, 8, 22, 0.8)',
          border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: '4px',
          padding: '3px 8px',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.12em' }}>
          GESTURE CONTROL
        </span>
        <span style={{
          fontSize: '7px',
          color: faceDetected ? '#22d3ee' : '#64748b',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}>
          {faceDetected ? '●' : '○'} FACE TRACKING
        </span>
      </div>

      {/* Blow status */}
      {statusText && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: showPulse
              ? 'rgba(34,211,238,0.12)'
              : 'rgba(2, 8, 22, 0.8)',
            border: `1px solid ${showPulse ? 'rgba(34,211,238,0.4)' : 'rgba(34,211,238,0.15)'}`,
            borderRadius: '4px',
            padding: '3px 8px',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Pulse dot */}
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: showPulse ? '#22d3ee' : '#0e7490',
              boxShadow: showPulse ? '0 0 8px #22d3ee' : 'none',
              transition: 'all 0.2s ease',
            }}
          />
          <span style={{
            fontSize: '8px',
            color: showPulse ? '#22d3ee' : '#94a3b8',
            letterSpacing: '0.1em',
            fontWeight: 600,
            fontFamily: 'monospace',
          }}>
            {statusText}
          </span>
          {detectorState === 'WAITING_FOR_BLOW_2' && timeSinceBlow1 > 0 && (
            <span style={{ fontSize: '7px', color: '#475569', fontFamily: 'monospace' }}>
              {(timeSinceBlow1 / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
