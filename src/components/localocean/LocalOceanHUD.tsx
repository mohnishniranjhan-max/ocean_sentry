import type { Station, DepthLevel } from '../../types/ocean';

interface LocalOceanHUDProps {
  station: Station;
  depth: DepthLevel;
  onDepthChange: (d: DepthLevel) => void;
  onExit: () => void;
}

const DEPTHS: DepthLevel[] = [0, 10, 50, 100, 500, 1000];

const DEPTH_LABELS: Record<number, string> = {
  0: 'SURFACE',
  10: '10 m',
  50: '50 m',
  100: '100 m',
  500: '500 m',
  1000: '1000 m',
};

export function LocalOceanHUD({ station, depth, onDepthChange, onExit }: LocalOceanHUDProps) {
  return (
    <>
      {/* Exit button — Top Center */}
      <div style={{ 
        position: 'absolute', 
        top: '72px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <button
          onClick={onExit}
          style={{
            background: 'rgba(2, 8, 18, 0.75)',
            border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: '6px',
            padding: '8px 16px',
            color: '#22d3ee',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,211,238,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(2, 8, 18, 0.75)'; }}
        >
          <span style={{ fontSize: '12px' }}>←</span>
          RETURN TO GLOBAL VIEW
        </button>
        {/* Mode indicator */}
        <div
          style={{
            background: 'rgba(2, 8, 18, 0.75)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '6px 12px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: '#22d3ee',
            boxShadow: '0 0 4px #22d3ee',
          }} />
          <span style={{ fontSize: '8px', color: '#94a3b8', letterSpacing: '0.15em', fontWeight: 600 }}>
            {depth === 0 ? 'SURFACE OBSERVATION' : depth < 100 ? 'SHALLOW DIVE' : depth < 500 ? 'MID-WATER' : 'DEEP OCEAN'}
          </span>
        </div>
      </div>
    </>
  );
}
