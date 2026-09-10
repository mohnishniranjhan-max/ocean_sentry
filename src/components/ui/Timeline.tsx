import { TIME_POINTS } from '../../utils/oceanCalc';

interface TimelineProps {
  timeIndex: number;
  isPlaying: boolean;
  onChange: (i: number) => void;
  onPlayPause: () => void;
}

export function Timeline({ timeIndex, isPlaying, onChange, onPlayPause }: TimelineProps) {
  const total = TIME_POINTS.length - 1;

  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderRadius: '8px',
        padding: '7px 16px',
        minWidth: '480px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        style={{
          width: 26, height: 26,
          borderRadius: '4px',
          border: isPlaying ? '1px solid rgba(34, 211, 238, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
          background: isPlaying ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(6, 78, 120, 0.3) 100%)' : 'rgba(255, 255, 255, 0.04)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isPlaying ? '0 0 12px rgba(34, 211, 238, 0.3)' : 'none',
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(34, 211, 238, 0.25)';
          e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isPlaying ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(6, 78, 120, 0.3) 100%)' : 'rgba(255, 255, 255, 0.04)';
          e.currentTarget.style.borderColor = isPlaying ? 'rgba(34, 211, 238, 0.6)' : 'rgba(255, 255, 255, 0.1)';
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="3" height="8" fill="#22d3ee" rx="0.5" />
            <rect x="6" y="1" width="3" height="8" fill="#22d3ee" rx="0.5" />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M2 1L9 5L2 9V1Z" fill="#22d3ee" />
          </svg>
        )}
      </button>

      {/* Time points strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, position: 'relative' }}>
        {TIME_POINTS.map((tp, i) => {
          const isActive = i === timeIndex;
          return (
            <button
              key={tp.label}
              onClick={() => {
                if (!tp.disabled) onChange(i);
              }}
              disabled={tp.disabled}
              style={{
                flex: 1, textAlign: 'center',
                fontSize: '8px', letterSpacing: '0.12em',
                fontFamily: 'monospace',
                color: tp.disabled ? '#475569' : (isActive ? '#38bdf8' : '#64748b'),
                fontWeight: isActive ? 800 : 500,
                background: isActive ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.18) 0%, rgba(6, 78, 120, 0.25) 100%)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.04)'}`,
                borderRadius: '4px',
                cursor: tp.disabled ? 'not-allowed' : 'pointer',
                opacity: tp.disabled ? 0.5 : 1,
                padding: '4px 0',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isActive ? '0 0 10px rgba(34, 211, 238, 0.2)' : 'none',
              }}
            >
              {tp.label}
              {isActive && (
                <div
                  className="led-pulse"
                  style={{
                    position: 'absolute',
                    bottom: '-4px', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 3, height: 3,
                    borderRadius: '50%',
                    background: '#22d3ee',
                    boxShadow: '0 0 6px #22d3ee',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Range Scrubber */}
      <div style={{ width: '90px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={total}
          value={timeIndex}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#22d3ee', cursor: 'pointer' }}
          aria-label="Time scrubber"
        />
      </div>
    </div>
  );
}
