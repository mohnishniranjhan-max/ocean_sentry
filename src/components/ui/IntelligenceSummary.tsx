import type { AnomalySummary } from '../../services/oceanApi';

interface IntelligenceSummaryProps {
  summary: AnomalySummary | null;
  isLoading: boolean;
  dataSource: string;
}

export function IntelligenceSummary({ summary, isLoading, dataSource }: IntelligenceSummaryProps) {
  if (isLoading || !summary || !summary.available) return null;

  return (
    <div
      className="tactical-glass tactical-grid-bg tactical-bracket-box font-hud"
      style={{
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: `0 16px 40px -10px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
        zIndex: 35,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="led-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#f8fafc', fontWeight: 800, fontFamily: 'monospace' }}>
            ML INTELLIGENCE MATRIX
          </span>
        </div>
        <span style={{ fontSize: '9px', color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(34, 211, 238, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(34, 211, 238, 0.25)' }}>QC ACTIVE</span>
      </div>

      {/* Score range */}
      <div>
        <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#64748b', marginBottom: '4px', fontWeight: 700, fontFamily: 'monospace' }}>
          ANOMALY SCORE RANGE
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '22px', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
            {summary.score_mean?.toFixed(3) ?? '—'}
          </span>
          <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>mean score</span>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
          [{summary.score_min?.toFixed(3) ?? '?'} — {summary.score_max?.toFixed(3) ?? '?'}]
        </div>
      </div>

      {/* Breakdown */}
      <div>
        <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#64748b', marginBottom: '6px', fontWeight: 700, fontFamily: 'monospace' }}>
          CLASSIFICATION SPREAD
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <StatusRow label="HIGH" count={summary.high_count ?? 0} color="#ef4444" total={summary.total_records ?? 1} />
          <StatusRow label="WARNING" count={summary.warning_count ?? 0} color="#f59e0b" total={summary.total_records ?? 1} />
          <StatusRow label="NORMAL" count={summary.normal_count ?? 0} color="#22c55e" total={summary.total_records ?? 1} />
        </div>
      </div>

      {/* Total */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.1em', fontWeight: 700, fontFamily: 'monospace' }}>
            TOTAL EVALUATED
          </span>
          <span style={{ fontSize: '12px', color: '#22d3ee', fontFamily: 'monospace', fontWeight: 700 }}>
            {(summary.total_records ?? 0).toLocaleString()} RECORDS
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#475569', marginTop: '4px', fontFamily: 'monospace' }}>
          {dataSource === 'api' ? 'Isolation Forest · Live In-Situ Telemetry' : 'Offline Reference Mode'}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '10px', color: '#64748b', width: '60px', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', minWidth: '32px', textAlign: 'right' }}>
        {count}
      </span>
    </div>
  );
}
