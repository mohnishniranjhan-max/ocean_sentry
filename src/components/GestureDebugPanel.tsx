import type { BlowDetectorState } from '../gestures/gestureTypes';

interface GestureDebugPanelProps {
  faceDetected: boolean;
  faceConfidence: number;
  blowScore: number;
  detectorState: BlowDetectorState;
  timeSinceBlow1: number;
}

export function GestureDebugPanel({
  faceDetected,
  faceConfidence,
  blowScore,
  detectorState,
  timeSinceBlow1,
}: GestureDebugPanelProps) {
  // Only show if ?debugGestures=true
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debugGestures')) return null;
  }

  const stateColor = (() => {
    switch (detectorState) {
      case 'BLOW_CANDIDATE':
      case 'BLOW_2_CANDIDATE':
        return '#f59e0b';
      case 'BLOW_1_CONFIRMED':
      case 'WAITING_FOR_BLOW_2':
        return '#38bdf8';
      case 'BLOW_BLOW_CONFIRMED':
        return '#22c55e';
      case 'COOLDOWN':
        return '#ef4444';
      default:
        return '#64748b';
    }
  })();

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        right: '16px',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.92)',
        border: '1px solid rgba(34,211,238,0.3)',
        borderRadius: '6px',
        padding: '10px 14px',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#e2e8f0',
        minWidth: '180px',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontSize: '8px', color: '#22d3ee', letterSpacing: '0.15em', marginBottom: 8, fontWeight: 600 }}>
        GESTURE DEBUG
      </div>

      <Row label="Face detected" value={faceDetected ? 'YES' : 'NO'} color={faceDetected ? '#22c55e' : '#ef4444'} />
      <Row label="Face confidence" value={faceConfidence.toFixed(2)} />
      <Row label="Blow score" value={blowScore.toFixed(2)} color={blowScore > 0.75 ? '#22d3ee' : undefined} />

      <div style={{ margin: '6px 0 4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
        <Row label="State" value={detectorState} color={stateColor} />
      </div>

      {timeSinceBlow1 > 0 && detectorState !== 'IDLE' && detectorState !== 'COOLDOWN' && (
        <Row label="Since blow #1" value={`${(timeSinceBlow1 / 1000).toFixed(2)} sec`} />
      )}

      {/* Score bar */}
      <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, blowScore * 100)}%`,
            height: '100%',
            background: blowScore > 0.75 ? '#22d3ee' : '#475569',
            transition: 'width 0.1s ease',
          }}
        />
      </div>
      <div style={{ marginTop: 2, fontSize: '7px', color: '#475569', textAlign: 'right' }}>
        threshold: 0.75
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ color: '#94a3b8' }}>{label}:</span>
      <span style={{ color: color ?? '#e2e8f0', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
