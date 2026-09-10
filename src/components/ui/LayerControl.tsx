import type { OceanLayer, OceanParameter, DepthLevel } from '../../types/ocean';
import { PARAMETER_CONFIG, DEPTH_LABELS } from '../../utils/oceanCalc';

interface LayerControlProps {
  layer: OceanLayer;
  onChange: (l: OceanLayer) => void;
}

const LAYERS: { key: OceanLayer; label: string; color: string }[] = [
  { key: 'model',       label: 'MODEL',       color: '#60a5fa' },
  { key: 'observation', label: 'OBSERVATIONS', color: '#22d3ee' },
  { key: 'difference',  label: 'DIFFERENCE',  color: '#f59e0b' },
  { key: 'anomaly',     label: 'ANOMALY',     color: '#ef4444' },
];

export function LayerControl({ layer, onChange }: LayerControlProps) {
  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud"
      style={{
        width: '184px',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', paddingBottom: '6px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      }}>
        <div style={{ fontSize: '8px', letterSpacing: '0.18em', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>
          DATA LAYER
        </div>
        <div className="led-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {LAYERS.map((l) => {
          const isActive = layer === l.key;
          return (
            <button
              key={l.key}
              onClick={() => onChange(l.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                background: isActive ? `${l.color}1c` : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? `${l.color}66` : 'rgba(255, 255, 255, 0.04)'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left',
                boxShadow: isActive ? `0 0 12px ${l.color}25, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isActive ? l.color : '#475569',
                boxShadow: isActive ? `0 0 8px ${l.color}` : 'none',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '8.5px', letterSpacing: '0.12em',
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'monospace',
              }}>
                {l.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Deviation scale legend */}
      {(layer === 'difference' || layer === 'anomaly') && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.14em', marginBottom: 4, fontWeight: 700 }}>
            DEVIATION SCALE
          </div>
          <div style={{
            height: '3px', borderRadius: '2px',
            background: 'linear-gradient(90deg, #22d3ee, #f59e0b, #ef4444)',
            marginBottom: 4,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '7px', color: '#64748b', fontWeight: 600 }}>LOW</span>
            <span style={{ fontSize: '7px', color: '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>HIGH DELTA</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParameterControlProps {
  parameter: OceanParameter;
  onChange: (p: OceanParameter) => void;
}

const PARAMS: OceanParameter[] = ['temperature', 'salinity', 'waveHeight', 'currentSpeed', 'seaLevel', 'ph', 'chlorophyll'];

export function ParameterControl({ parameter, onChange }: ParameterControlProps) {
  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud"
      style={{
        width: '184px',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', paddingBottom: '6px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      }}>
        <div style={{ fontSize: '8px', letterSpacing: '0.18em', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>
          OCEAN PARAMETER
        </div>
        <div className="led-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {PARAMS.map((p) => {
          const cfg = PARAMETER_CONFIG[p];
          const isActive = p === parameter;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: isActive ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.18) 0%, rgba(6, 78, 120, 0.25) 100%)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? 'rgba(34, 211, 238, 0.55)' : 'rgba(255, 255, 255, 0.04)'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left',
                boxShadow: isActive ? '0 0 12px rgba(34, 211, 238, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
              }}
            >
              <span style={{
                fontSize: '8.5px', letterSpacing: '0.1em',
                color: isActive ? '#38bdf8' : '#cbd5e1',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'monospace',
              }}>
                {cfg.shortLabel}
              </span>
              <span style={{
                fontSize: '7.5px',
                color: isActive ? '#38bdf8' : '#64748b',
                fontFamily: 'monospace',
                background: isActive ? 'rgba(34, 211, 238, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                padding: '1px 4px',
                borderRadius: '2px',
              }}>
                {cfg.unit}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DepthControlProps {
  depth: DepthLevel;
  onChange: (d: DepthLevel) => void;
}

const DEPTHS: DepthLevel[] = [0, 10, 50, 100, 500, 1000];

export function DepthControl({ depth, onChange }: DepthControlProps) {
  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud"
      style={{
        width: '184px',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', paddingBottom: '6px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      }}>
        <div style={{ fontSize: '8px', letterSpacing: '0.18em', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>
          WATER DEPTH
        </div>
        <div className="led-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {DEPTHS.map((d, i) => {
          const isActive = d === depth;
          const depthPct = i / (DEPTHS.length - 1);
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                background: isActive ? 'rgba(34, 211, 238, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.04)'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                boxShadow: isActive ? '0 0 10px rgba(34, 211, 238, 0.2)' : 'none',
              }}
            >
              {/* Depth bar indicator */}
              <div style={{
                width: `${8 + depthPct * 16}px`,
                height: '2px',
                borderRadius: '1px',
                background: isActive ? '#38bdf8' : `rgba(56, 189, 248, ${0.2 + depthPct * 0.15})`,
                boxShadow: isActive ? '0 0 6px rgba(56, 189, 248, 0.6)' : 'none',
              }} />
              <span style={{
                fontSize: '8.5px', letterSpacing: '0.1em',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'monospace',
              }}>
                {DEPTH_LABELS[d]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
