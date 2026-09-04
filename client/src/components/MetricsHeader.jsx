import React, { useEffect, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Percent,
  Zap,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

/**
 * Formats a number as INR currency string.
 * @param {number} value
 * @returns {string}
 */
function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

/**
 * Single KPI card component.
 */
function KpiCard({ icon: Icon, label, value, subtext, gradient, glowColor, loading }) {
  return (
    <div
      className={`card-hover relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-3`}
      style={{ boxShadow: `0 0 0 1px ${glowColor}18` }}
    >
      {/* Ambient glow background */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ background: glowColor }}
      />

      {/* Header Row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `${glowColor}20`, border: `1px solid ${glowColor}30` }}
        >
          <Icon size={16} style={{ color: glowColor }} strokeWidth={2.5} />
        </div>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-8 w-36 rounded-md shimmer" />
      ) : (
        <p className={`text-2xl font-bold tracking-tight ${gradient}`}>{value}</p>
      )}

      {/* Subtext */}
      {loading ? (
        <div className="h-3.5 w-24 rounded shimmer" />
      ) : (
        <p className="text-xs text-slate-500">{subtext}</p>
      )}
    </div>
  );
}

/**
 * MetricsHeader
 * Fetches live KPI data from /api/metrics and displays 4 cards.
 */
export default function MetricsHeader({ onRefresh, lastRefreshed }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [spinning, setSpinning] = useState(false);

  async function fetchMetrics() {
    try {
      setSpinning(true);
      setLoading(true);
      setError(null);
      const res  = await fetch(`${API_BASE}/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMetrics(json.data);
    } catch (err) {
      setError('Unable to reach the API. Is the server running on port 5000?');
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 600);
    }
  }

  useEffect(() => { fetchMetrics(); }, [lastRefreshed]);

  const cards = [
    {
      icon: TrendingDown,
      label: 'Revenue At-Risk',
      value: formatINR(metrics?.total_at_risk_revenue),
      subtext: 'Total across all failed events',
      gradient: 'text-red-400',
      glowColor: '#f87171',
    },
    {
      icon: TrendingUp,
      label: 'Recovered Revenue',
      value: formatINR(metrics?.total_recovered_revenue),
      subtext: 'Successfully reclaimed',
      gradient: 'text-emerald-400',
      glowColor: '#34d399',
    },
    {
      icon: Percent,
      label: 'Recovery Rate',
      value: `${metrics?.recovery_rate_percent ?? 0}%`,
      subtext: 'Recovered ÷ total failures',
      gradient: 'gradient-text',
      glowColor: '#3b82f6',
    },
    {
      icon: Zap,
      label: 'Active Interventions',
      value: metrics?.total_failed_count ?? 0,
      subtext: 'Events pending AI action',
      gradient: 'text-cyan-400',
      glowColor: '#06b6d4',
    },
  ];

  return (
    <section>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Live Recovery Metrics
        </h2>
        <button
          onClick={() => { fetchMetrics(); onRefresh?.(); }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-blue-500 hover:text-white active:scale-95"
          title="Refresh metrics"
        >
          <RefreshCw
            size={12}
            className={spinning ? 'animate-spin' : ''}
            strokeWidth={2.5}
          />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} strokeWidth={2} />
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} loading={loading} />
        ))}
      </div>
    </section>
  );
}
