import React from 'react';

export type WindSystemType = 'trade' | 'westerlies' | 'polar' | 'monsoons' | 'breeze';

export interface WindSystemConfig {
  id: WindSystemType;
  label: string;
  color: string;
}

export const WIND_SYSTEMS_CONFIG: WindSystemConfig[] = [
  { id: 'trade', label: 'TRADE WINDS', color: '#22d3ee' },
  { id: 'westerlies', label: 'WESTERLIES', color: '#38bdf8' },
  { id: 'polar', label: 'POLAR EASTERLIES', color: '#93c5fd' },
  { id: 'monsoons', label: 'MONSOONS', color: '#818cf8' },
  { id: 'breeze', label: 'SEA BREEZES', color: '#c084fc' },
];

interface WindControlPanelProps {
  activeSystems: Set<WindSystemType>;
  onChange: (systems: Set<WindSystemType>) => void;
}

export function WindControlPanel({ activeSystems, onChange }: WindControlPanelProps) {
  const toggleSystem = (id: WindSystemType) => {
    const next = new Set(activeSystems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  const isolateSystem = (id: WindSystemType, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set<WindSystemType>();
    next.add(id);
    onChange(next);
  };

  const toggleAll = () => {
    if (activeSystems.size === WIND_SYSTEMS_CONFIG.length) {
      onChange(new Set());
    } else {
      onChange(new Set(WIND_SYSTEMS_CONFIG.map(s => s.id)));
    }
  };

  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud"
      style={{
        width: '184px',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', paddingBottom: '6px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      }}>
        <div style={{ fontSize: '8px', letterSpacing: '0.18em', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>
          WIND CHANNELS
        </div>
        <button 
          onClick={toggleAll}
          style={{ fontSize: '7.5px', color: '#22d3ee', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'monospace', fontWeight: 700 }}
        >
          {activeSystems.size === WIND_SYSTEMS_CONFIG.length ? 'HIDE ALL' : 'SHOW ALL'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {WIND_SYSTEMS_CONFIG.map((sys) => {
          const isActive = activeSystems.has(sys.id);
          return (
            <div
              key={sys.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                background: isActive ? `${sys.color}12` : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? `${sys.color}3a` : 'rgba(255, 255, 255, 0.04)'}`,
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <button
                onClick={() => toggleSystem(sys.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexGrow: 1,
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isActive ? sys.color : '#334155',
                  boxShadow: isActive ? `0 0 6px ${sys.color}` : 'none',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '7.5px', letterSpacing: '0.1em',
                  color: isActive ? '#f8fafc' : '#64748b',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'monospace',
                }}>
                  {sys.label}
                </span>
              </button>
              
              <button
                onClick={(e) => isolateSystem(sys.id, e)}
                title="Isolate this channel"
                style={{
                  fontSize: '6.5px',
                  color: isActive && activeSystems.size === 1 ? '#22d3ee' : '#64748b',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                SOLO
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
