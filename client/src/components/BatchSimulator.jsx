import React, { useState, useRef, useEffect } from 'react';
import {
  Zap, Play, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, BarChart3, ShieldAlert, Loader2, ChevronDown,
  ChevronUp, RefreshCw, Info,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Outcome config ───────────────────────────────────────────────────────────

const OUTCOME = {
  RECOVERED:  { label: 'Recovered',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  Icon: CheckCircle2 },
  PROCESSING: { label: 'Scheduled',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  Icon: Clock        },
  BLOCKED:    { label: 'Blocked',    color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   Icon: XCircle      },
  ERROR:      { label: 'Error',      color: '#94a3b8', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', Icon: AlertTriangle },
  SKIPPED:    { label: 'Skipped',    color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', Icon: AlertTriangle },
};

// ─── Animated Progress Bar ────────────────────────────────────────────────────

function ProgressBar({ value, max, color = '#3b82f6', animated = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width:      `${pct}%`,
          background: animated
            ? `linear-gradient(90deg, ${color}, ${color}cc, ${color})`
            : color,
          backgroundSize:     animated ? '200% 100%' : undefined,
          animation:          animated ? 'shimmer 1.2s infinite linear' : undefined,
          boxShadow:          `0 0 8px ${color}60`,
        }}
      />
    </div>
  );
}

// ─── Pulsing Step Indicator ───────────────────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: Math.min(total, 18) }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width:      i < current ? 12 : 6,
            background: i < current
              ? (i === current - 1 ? '#06b6d4' : '#3b82f6')
              : '#1e293b',
            boxShadow:  i === current - 1 ? '0 0 6px #06b6d4' : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({ result, index }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = OUTCOME[result.outcome] ?? OUTCOME.SKIPPED;
  const { Icon } = cfg;

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all duration-200"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-110 transition"
      >
        {/* Step number */}
        <span className="shrink-0 text-[10px] font-mono text-slate-600 w-5 text-right">
          {String(index + 1).padStart(2, '0')}
        </span>

        <Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} strokeWidth={2.5} />

        <span className="flex-1 min-w-0 text-xs font-semibold text-slate-300 truncate">
          {result.customer_name}
        </span>

        <span className="shrink-0 text-[10px] font-mono text-slate-500">
          {formatINR(result.amount)}
        </span>

        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded"
          style={{ background: `${cfg.color}20`, color: cfg.color }}>
          {cfg.label}
        </span>

        <span className="shrink-0 text-[10px] text-slate-500 hidden sm:block">
          {result.chosen_action !== '—' ? result.chosen_action : ''}
        </span>

        {expanded
          ? <ChevronUp size={12} className="shrink-0 text-slate-600" />
          : <ChevronDown size={12} className="shrink-0 text-slate-600" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2 text-xs text-slate-400"
          style={{ borderColor: cfg.border }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-slate-600">Rule Applied</span>
            <span className="font-mono text-slate-300">{result.rule_applied}</span>

            <span className="text-slate-600">Risk Score</span>
            <span className="font-mono" style={{ color: result.risk_score > 0.8 ? '#f87171' : '#fbbf24' }}>
              {result.risk_score.toFixed(2)}
            </span>

            {result.discount_offered > 0 && (
              <>
                <span className="text-slate-600">Discount Offered</span>
                <span className="text-emerald-400 font-semibold">{result.discount_offered}%</span>
              </>
            )}
          </div>
          {result.message_content && (
            <p className="mt-2 rounded-md bg-slate-900/50 px-3 py-2 italic text-slate-500 leading-relaxed border border-slate-800">
              "{result.message_content.slice(0, 200)}{result.message_content.length > 200 ? '…' : ''}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary KPI Card ─────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color, glow }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#0B0F19] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${glow}18` }}>
          <Icon size={16} style={{ color: glow }} strokeWidth={2.5} />
        </div>
        <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * BatchSimulator
 * Bulk AI Recovery control panel.
 *
 * Props:
 *   onBatchComplete  {function}  — called after a successful batch run so
 *                                  parent can refresh metrics + event table
 */
export default function BatchSimulator({ onBatchComplete }) {
  const [phase,     setPhase]     = useState('idle'); // idle | running | done | error
  const [progress,  setProgress]  = useState(0);      // 0–100 (animated fake progress)
  const [summary,   setSummary]   = useState(null);
  const [results,   setResults]   = useState([]);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [elapsed,   setElapsed]   = useState(0);
  const [dryRun,    setDryRun]    = useState(false);
  const [showLog,   setShowLog]   = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // ── Animate progress bar while running ──────────────────────────────────────
  useEffect(() => {
    if (phase === 'running') {
      startRef.current = Date.now();
      setProgress(5);

      // Fake progress: logarithmically approach 90% while waiting for response
      timerRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 88) return p;
          return p + (88 - p) * 0.07;
        });
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 200);
    } else {
      clearInterval(timerRef.current);
      if (phase === 'done')  setProgress(100);
      if (phase === 'error') setProgress(0);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Trigger batch run ────────────────────────────────────────────────────────
  async function runBatch() {
    setPhase('running');
    setProgress(5);
    setSummary(null);
    setResults([]);
    setErrorMsg('');
    setShowLog(false);

    try {
      const res  = await fetch(`${API_BASE}/simulate-batch`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dry_run: dryRun }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error ?? 'Batch failed');

      setSummary(json.summary);
      setResults(json.results ?? []);
      setPhase('done');
      if (!dryRun) onBatchComplete?.();
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }

  function reset() {
    setPhase('idle');
    setProgress(0);
    setSummary(null);
    setResults([]);
    setErrorMsg('');
    setShowLog(false);
    setElapsed(0);
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const isRunning  = phase === 'running';
  const isDone     = phase === 'done';
  const isError    = phase === 'error';
  const isIdle     = phase === 'idle';

  const progressColor = isError ? '#ef4444' : isDone ? '#10b981' : '#3b82f6';

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] shadow-sm overflow-hidden p-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', boxShadow: '0 0 16px rgba(59,130,246,0.3)' }}>
            <BarChart3 size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">AI Batch Recovery Engine</h2>
            <p className="text-sm text-slate-400 mt-1">
              Bulk-process all FAILED events through guardrails + LLM pipeline
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Dry Run Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none"
            title="Dry run: simulate without writing to database">
            <div
              onClick={() => !isRunning && setDryRun(d => !d)}
              className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${dryRun ? 'bg-amber-500/60' : 'bg-slate-700'} ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform duration-200 ${dryRun ? 'translate-x-4 bg-amber-400' : 'translate-x-0.5 bg-slate-400'}`} />
            </div>
            <span className="text-[11px] text-slate-500">Dry Run</span>
            <Info size={11} className="text-slate-700" />
          </label>

          {/* Action Buttons */}
          {(isDone || isError) && (
            <button onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-600 transition active:scale-95">
              <RefreshCw size={11} strokeWidth={2.5} />
              Reset
            </button>
          )}

          <button
            id="run-batch-recovery"
            onClick={runBatch}
            disabled={isRunning}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95
              ${isRunning
                ? 'cursor-not-allowed bg-blue-900/40 text-blue-400/60 border border-blue-500/20'
                : 'text-white border border-blue-500/40 hover:border-blue-400'
              }`}
            style={isRunning ? {} : {
              background:  'linear-gradient(135deg,#3b82f6,#06b6d4)',
              boxShadow:   '0 0 20px rgba(59,130,246,0.35)',
            }}
          >
            {isRunning
              ? <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />
              : <Zap      size={15} strokeWidth={2.5} />}
            {isRunning ? `Running… ${elapsed}s` : 'Run AI Batch Recovery'}
          </button>
        </div>
      </div>

      {/* ── Progress Section ── */}
      <div className="space-y-4 mb-6">

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <span>
              {isIdle     && 'Ready to simulate'}
              {isRunning  && 'Processing events through AI pipeline…'}
              {isDone     && `Completed in ${formatMs(summary?.duration_ms ?? 0)}`}
              {isError    && 'Simulation failed'}
            </span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <ProgressBar
            value={progress}
            max={100}
            color={progressColor}
            animated={isRunning}
          />
        </div>

        {/* Step indicators (only while running) */}
        {isRunning && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600">Pipeline</span>
            <StepIndicator current={Math.round(progress / 6)} total={18} />
          </div>
        )}

        {/* Error banner */}
        {isError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle size={15} strokeWidth={2} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ── Summary KPIs (shown after run) ── */}
      {isDone && summary && (
        <div className="border-t border-slate-800 pt-6">

          {/* Dry run badge */}
          {summary.dry_run && (
            <div className="mt-4 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-400">
              <Info size={12} strokeWidth={2.5} />
              Dry Run — Results simulated only. No database changes were made.
            </div>
          )}

          {/* KPI grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard
              icon={BarChart3}   label="Processed"
              value={summary.total_processed}
              color="#e2e8f0"    glow="#94a3b8"
            />
            <SummaryCard
              icon={CheckCircle2} label="Recovered"
              value={summary.recovered_count}
              color="#34d399"    glow="#10b981"
            />
            <SummaryCard
              icon={Clock}       label="Scheduled"
              value={summary.scheduled_count}
              color="#fbbf24"    glow="#f59e0b"
            />
            <SummaryCard
              icon={ShieldAlert} label="Blocked"
              value={summary.blocked_count}
              color="#f87171"    glow="#ef4444"
            />
            <SummaryCard
              icon={TrendingUp}  label="Revenue Saved"
              value={formatINR(summary.total_amount_recovered)}
              color="#60a5fa"    glow="#3b82f6"
            />
            <SummaryCard
              icon={Zap}         label="Duration"
              value={formatMs(summary.duration_ms)}
              color="#c084fc"    glow="#a855f7"
            />
          </div>

          {/* Stacked bar breakdown */}
          <div className="mt-4 space-y-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-600">Outcome Breakdown</span>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800 gap-px">
              {[
                { count: summary.recovered_count,  color: '#10b981' },
                { count: summary.scheduled_count,  color: '#f59e0b' },
                { count: summary.blocked_count,    color: '#ef4444' },
                { count: summary.skipped_count,    color: '#475569' },
              ].map(({ count, color }, i) => {
                const pct = summary.total_processed > 0
                  ? (count / summary.total_processed) * 100 : 0;
                return pct > 0 ? (
                  <div key={i} className="h-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }} />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
              {[
                { label: 'Recovered', color: '#10b981', count: summary.recovered_count },
                { label: 'Scheduled', color: '#f59e0b', count: summary.scheduled_count },
                { label: 'Blocked',   color: '#ef4444', count: summary.blocked_count   },
                { label: 'Skipped',   color: '#475569', count: summary.skipped_count   },
              ].map(({ label, color, count }) => count > 0 && (
                <span key={label} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label} ({count})
                </span>
              ))}
            </div>
          </div>

          {/* Per-event log toggle */}
          {results.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowLog(s => !s)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition"
              >
                {showLog ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
                {showLog ? 'Hide' : 'Show'} per-event log ({results.length} events)
              </button>

              {showLog && (
                <div className="mt-3 max-h-96 overflow-y-auto space-y-1.5 pr-1">
                  {results.map((r, i) => (
                    <ResultRow key={r.event_id} result={r} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
