import React from 'react';
import type { OceanParameter } from '../../types/ocean';
import { PARAMETER_CONFIG } from '../../utils/oceanCalc';

interface ColorLegendProps {
  parameter: OceanParameter;
}

export function ColorLegend({ parameter }: ColorLegendProps) {
  const config = PARAMETER_CONFIG[parameter];

  if (!config) return null;

  return (
    <div
      className="sci-panel animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px 16px',
        width: '220px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>
          {config.label.toUpperCase()}
        </span>
        <span style={{ fontSize: '9px', color: '#64748b' }}>{config.unit}</span>
      </div>

      <div
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: `linear-gradient(90deg, ${config.colors.join(', ')})`,
          marginTop: '2px',
          marginBottom: '2px',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: '#e2e8f0', fontFamily: 'monospace' }}>
          {config.min}
        </span>
        <span style={{ fontSize: '9px', color: '#e2e8f0', fontFamily: 'monospace' }}>
          {config.max}
        </span>
      </div>
    </div>
  );
}
