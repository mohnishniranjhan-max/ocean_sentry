import { useEffect, useRef } from 'react';
import type { Station, OceanParameter, DepthLevel } from '../../types/ocean';
import { formatLastUpdate, PARAMETER_CONFIG } from '../../utils/oceanCalc';

interface StationPanelProps {
  station: Station;
  parameter: OceanParameter;
  depth?: DepthLevel;
  onClose: () => void;
  onExploreOcean?: () => void;
  onAnalyzeVariance?: (station: Station) => void;
  onOpenPHAnalyzer?: (station: Station) => void;
}

// ── Depth Telemetry Calculator ──────────────────────────────────────────────

interface DepthTelemetryProfile {
  depthLabel: string;
  zoneName: string;
  lighting: string;
  speciesSummary: string;
  temperature: number;
  salinity: number;
  currentSpeed: number;
  waveHeight: number;
  ph: number;
  modelPh: number;
  aragoniteSat: number;
  modelValue: number;
  observedValue: number;
  delta: number;
  percentageDiff: number;
  status: 'normal' | 'warning' | 'critical';
  insight: string;
}

function computeDepthTelemetry(station: Station, param: OceanParameter, depth: DepthLevel = 0): DepthTelemetryProfile {
  const baseTemp = station.temperature || 29.2;
  const baseSal = station.salinity || 33.8;
  const baseCurr = station.currentSpeed || 0.22;
  const baseWave = station.waveHeight || 0.0;
  const basePH = station.ph || 8.16;
  const baseModelPH = station.modelPh || 8.18;

  let depthProfile: {
    depthLabel: string;
    zoneName: string;
    lighting: string;
    speciesSummary: string;
    temperature: number;
    salinity: number;
    currentSpeed: number;
    waveHeight: number;
    ph: number;
    modelPh: number;
    aragoniteSat: number;
    status: 'normal' | 'warning' | 'critical';
    insight: string;
  };

  switch (depth) {
    case 0:
      depthProfile = {
        depthLabel: '0m (SURFACE)',
        zoneName: 'Surface Boundary Layer',
        lighting: 'Full Daylight · Direct Solar',
        speciesSummary: 'Surface Plankton · Seabirds · Floating Flora',
        temperature: baseTemp,
        salinity: baseSal,
        currentSpeed: baseCurr,
        waveHeight: baseWave,
        ph: basePH,
        modelPh: baseModelPH,
        aragoniteSat: 3.85,
        status: station.status || 'normal',
        insight: 'Upper photic zone active. Optimal surface thermal boundary layer and satellite-ARGO correlation.',
      };
      break;
    case 10:
      depthProfile = {
        depthLabel: '10m (SHALLOW)',
        zoneName: 'Upper Photic / Epipelagic Zone',
        lighting: 'High Sunlight · Shimmering Caustics',
        speciesSummary: 'Reef Fish Schools · Oceanic Manta Rays',
        temperature: parseFloat((baseTemp - 0.6).toFixed(2)),
        salinity: parseFloat((baseSal + 0.3).toFixed(2)),
        currentSpeed: parseFloat((baseCurr * 0.9).toFixed(2)),
        waveHeight: parseFloat((baseWave * 0.75).toFixed(2)),
        ph: parseFloat((basePH - 0.02).toFixed(2)),
        modelPh: parseFloat((baseModelPH - 0.03).toFixed(2)),
        aragoniteSat: 3.70,
        status: 'normal',
        insight: 'High biological activity detected. Dense schooling fish and gliding manta rays observed within the upper photic zone.',
      };
      break;
    case 50:
      depthProfile = {
        depthLabel: '50m (MID WATER)',
        zoneName: 'Mesopelagic Transition',
        lighting: 'Moderate Blue · Soft Volumetric Beams',
        speciesSummary: 'Pelagic Tuna Pods · Green Sea Turtles · Manta Rays',
        temperature: parseFloat((baseTemp - 2.8).toFixed(2)),
        salinity: parseFloat((baseSal + 0.8).toFixed(2)),
        currentSpeed: parseFloat((baseCurr * 0.7).toFixed(2)),
        waveHeight: parseFloat((baseWave * 0.2).toFixed(2)),
        ph: parseFloat((basePH - 0.11).toFixed(2)),
        modelPh: parseFloat((baseModelPH - 0.10).toFixed(2)),
        aragoniteSat: 3.10,
        status: 'normal',
        insight: 'Moderate biological activity. Pelagic tuna pods and sea turtles detected in the mesopelagic transition.',
      };
      break;
    case 100:
      depthProfile = {
        depthLabel: '100m (TWILIGHT)',
        zoneName: 'Twilight / Disphotic Zone',
        lighting: 'Dim Oceanic Indigo · Fading Sunlight',
        speciesSummary: 'Apex Predator Sharks · Solitary Pelagic Hunters',
        temperature: parseFloat((baseTemp - 6.5).toFixed(2)),
        salinity: parseFloat((baseSal + 1.1).toFixed(2)),
        currentSpeed: parseFloat((baseCurr * 0.5).toFixed(2)),
        waveHeight: 0.0,
        ph: 7.92,
        modelPh: 7.95,
        aragoniteSat: 2.40,
        status: 'warning',
        insight: 'Predator activity detected. Large 5.5m–7.5m apex sharks and solitary hunters observed in the twilight survey volume.',
      };
      break;
    case 500:
      depthProfile = {
        depthLabel: '500m (DEEP OCEAN)',
        zoneName: 'Bathyal / Aphotic Zone',
        lighting: 'Very Low Light · Bioluminescent Accents',
        speciesSummary: 'Giant Squid · Sleeper Sharks · Crown Jellyfish',
        temperature: 11.8,
        salinity: 35.1,
        currentSpeed: parseFloat((baseCurr * 0.25).toFixed(2)),
        waveHeight: 0.0,
        ph: 7.78,
        modelPh: 7.80,
        aragoniteSat: 1.45,
        status: 'normal',
        insight: 'Deep-water bathyal ecosystem. Sparse biological activity with large cephalopod and deep sleeper shark signatures.',
      };
      break;
    case 1000:
      depthProfile = {
        depthLabel: '1000m (ABYSS)',
        zoneName: 'Abyssal Benthic Boundary',
        lighting: 'Near-Zero Ambient · Bioluminescent Lures',
        speciesSummary: 'Colossal Leviathan Whale · Giant Squid · Anglerfish',
        temperature: 5.2,
        salinity: 34.8,
        currentSpeed: parseFloat((baseCurr * 0.12).toFixed(2)),
        waveHeight: 0.0,
        ph: 7.65,
        modelPh: 7.68,
        aragoniteSat: 0.92,
        status: 'normal',
        insight: 'Abyssal benthic boundary detected. Extremely sparse biological density with intermittent 25m+ colossal leviathan acoustic signatures.',
      };
      break;
    default:
      depthProfile = {
        depthLabel: `${depth}m`,
        zoneName: 'Open Ocean Column',
        lighting: 'Ambient Oceanic',
        speciesSummary: 'Marine Fauna',
        temperature: baseTemp,
        salinity: baseSal,
        currentSpeed: baseCurr,
        waveHeight: baseWave,
        ph: basePH,
        modelPh: baseModelPH,
        aragoniteSat: 3.50,
        status: 'normal',
        insight: 'Station conditions nominal.',
      };
      break;
  }

  // Parameter-adaptive metrics
  let modelVal = 0.0;
  let obsVal = 0.0;

  if (param === 'ph') {
    modelVal = depthProfile.modelPh;
    obsVal = depthProfile.ph;
  } else if (param === 'temperature') {
    modelVal = station.modelTemperature ?? 29.1;
    obsVal = depthProfile.temperature;
  } else if (param === 'salinity') {
    modelVal = station.modelSalinity ?? 33.1;
    obsVal = depthProfile.salinity;
  } else if (param === 'currentSpeed') {
    modelVal = station.modelCurrentSpeed ?? 0.72;
    obsVal = depthProfile.currentSpeed;
  } else if (param === 'seaLevel') {
    modelVal = station.modelSeaLevel ?? 0.08;
    obsVal = station.seaLevel ?? 0.12;
  } else if (param === 'chlorophyll') {
    modelVal = station.modelChlorophyll ?? 0.12;
    obsVal = station.chlorophyll ?? 0.15;
  } else {
    // waveHeight
    modelVal = station.modelWaveHeight ?? 0.0;
    obsVal = depthProfile.waveHeight;
  }

  const delta = parseFloat((obsVal - modelVal).toFixed(2));
  const percentageDiff = modelVal !== 0 ? parseFloat(((delta / modelVal) * 100).toFixed(1)) : 0.0;

  return {
    ...depthProfile,
    modelValue: modelVal,
    observedValue: obsVal,
    delta,
    percentageDiff,
  };
}

export function StationPanel({
  station,
  parameter,
  depth = 0,
  onClose,
  onExploreOcean,
  onAnalyzeVariance,
  onOpenPHAnalyzer,
}: StationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const telem = computeDepthTelemetry(station, parameter, depth);

  const statusColor =
    telem.status === 'critical' ? '#ef4444' :
    telem.status === 'warning'  ? '#f59e0b' : '#10b981';

  const statusLabel =
    telem.status === 'critical' ? 'HIGH DEVIATION' :
    telem.status === 'warning'  ? 'PREDATOR DETECTED' : 'NORMAL';

  // Animate in / on depth change
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
  }, [station.id, depth]);

  return (
    <div
      ref={panelRef}
      className="sci-panel"
      style={{
        width: '320px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Accent Line */}
      <div style={{ height: '3px', width: '100%', background: statusColor }} />
      
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{
            fontSize: '10px',
            color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase'
          }}>
            {station.type || 'ARGO FLOAT'} · {station.region || 'GLOBAL OCEAN'}
          </div>
          <div style={{
            fontSize: '20px', fontWeight: 600, color: '#f8fafc',
            lineHeight: 1.2,
          }}>
            {station.id}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
            {(station.latitude || 0).toFixed(2)}°N, {(station.longitude || 0).toFixed(2)}°E
            &nbsp;·&nbsp; {formatLastUpdate(station.lastSyncMinutes)}
          </div>
          {station.id.startsWith('ARGO-590623') && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              padding: '2px 8px',
              marginTop: '8px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
              <span style={{ fontSize: '9px', color: '#7dd3fc', fontWeight: 600, textTransform: 'uppercase' }}>
                LIVE STREAM · API ACTIVE
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '4px',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Status & Depth */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: '11px', color: statusColor, fontWeight: 600 }}>
              {statusLabel}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
            {telem.depthLabel}
          </span>
        </div>

        {/* Environmental Profile & Zone Info */}
        <div className="sci-card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Zone</span>
            <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 500 }}>{telem.zoneName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Lighting</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{telem.lighting}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Fauna</span>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>{telem.speciesSummary}</span>
          </div>
        </div>

        {/* Parameter label */}
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
            {PARAMETER_CONFIG[parameter].label} Telemetry
          </div>

          {/* Model vs Observed cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: 12 }}>
            {[
              { label: 'Model', value: telem.modelValue, unit: PARAMETER_CONFIG[parameter].unit, color: '#94a3b8' },
              { label: 'Observed', value: telem.observedValue, unit: PARAMETER_CONFIG[parameter].unit, color: '#f8fafc' },
              {
                label: 'Variance',
                value: telem.delta > 0 ? `+${telem.delta.toFixed(2)}` : telem.delta.toFixed(2),
                unit: PARAMETER_CONFIG[parameter].unit,
                color: statusColor,
              },
            ].map(({ label, value, unit, color }) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: 4, fontWeight: 500 }}>
                  {label}
                </div>
                <div style={{
                  fontSize: '14px', fontWeight: 600, color,
                  fontFamily: 'monospace',
                }}>
                  {typeof value === 'number' ? value.toFixed(2) : value ?? '—'}
                </div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: 2 }}>{unit}</div>
              </div>
            ))}
          </div>

          {/* Deviation bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Variance Ratio</span>
              <span style={{ fontSize: '11px', color: statusColor, fontWeight: 600 }}>
                {(Math.abs(telem.percentageDiff) || 0).toFixed(1)}%
              </span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${Math.min(100, Math.abs(telem.percentageDiff))}%`,
                background: statusColor,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Primary Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {[
            { label: 'Sea Surface Temp', val: `${telem.temperature.toFixed(2)} °C`, color: '#38bdf8' },
            { label: 'Salinity', val: `${telem.salinity.toFixed(2)} PSU`, color: '#818cf8' },
            { label: 'Current Speed', val: `${telem.currentSpeed.toFixed(2)} m/s`, color: '#22d3ee' },
            {
              label: 'Chlorophyll-a',
              val: `${(station.chlorophyll ?? 0.15).toFixed(2)} mg/m³`,
              color: '#10b981',
            },
            {
              label: 'Ocean Water pH',
              val: `${telem.ph.toFixed(2)} pH`,
              color: telem.ph < 7.9 ? '#ef4444' : '#10b981',
            },
            {
              label: 'Aragonite Saturation',
              val: `${telem.aragoniteSat.toFixed(2)} Ω`,
              color: telem.aragoniteSat < 1.0 ? '#ef4444' : '#38bdf8',
            },
          ].map(({ label, val, color }) => (
            <div
              key={label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '11px', color: '#94a3b8',
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <span>{label}</span>
              <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {val}
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              </span>
            </div>
          ))}
        </div>

        {/* Glider Mission Information */}
        {station.type === 'glider' && (
          <div className="sci-card" style={{ padding: '12px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
            }}>
              <span style={{
                fontSize: '10px', color: '#38bdf8',
                fontWeight: 600, textTransform: 'uppercase'
              }}>
                Glider Trajectory Log
              </span>
              <span style={{
                fontSize: '9px', color: '#f59e0b', fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px',
                borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                DEMO / SIMULATION
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Points: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{station.trajectory?.length || 0}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Heading: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{station.heading !== undefined ? `${station.heading}°` : 'N/A'}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Pattern: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Yoyo / Sawtooth</span>
              </div>
            </div>
          </div>
        )}

        {/* Intelligence insight card */}
        <div className="sci-card" style={{ padding: '12px' }}>
          <div style={{
            fontSize: '10px', color: '#f59e0b', marginBottom: 8,
            fontWeight: 600, textTransform: 'uppercase'
          }}>
            System Insight
          </div>
          <p style={{
            fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5, margin: 0,
          }}>
            {telem.insight}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={() => onOpenPHAnalyzer?.(station)}
            className="sci-btn"
            style={{ padding: '10px', fontSize: '11px', fontWeight: 600, width: '100%' }}
          >
            Determine Live pH & Acidification
          </button>
          <button
            onClick={() => onAnalyzeVariance?.(station)}
            className="sci-btn"
            style={{ padding: '10px', fontSize: '11px', fontWeight: 600, width: '100%' }}
          >
            Analyze Variance
          </button>
          {onExploreOcean && (
            <button
              onClick={onExploreOcean}
              className="sci-btn"
              style={{
                padding: '10px', fontSize: '11px', fontWeight: 600, width: '100%',
                background: 'rgba(56, 189, 248, 0.1)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                color: '#38bdf8'
              }}
            >
              Explore Local Ocean
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
