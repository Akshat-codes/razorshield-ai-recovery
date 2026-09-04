import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, RefreshCw, AlertCircle, TrendingUp, Shield, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ─── Design tokens (Razorpay palette) ────────────────────────────────────────
const C = {
  blue:    '#3b82f6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  violet:  '#8b5cf6',
  cyan:    '#06b6d4',
  slate:   '#64748b',
};

const CATEGORY_COLORS = {
  UPI_TIMEOUT:          C.blue,
  GATEWAY_DOWNTIME:     C.cyan,
  CART_DROP_OFF:        C.violet,
  AUTO_DEBIT_FAILURE:   C.amber,
  INSUFFICIENT_FUNDS:   C.red,
  INVOICE_OVERDUE_15D:  '#f97316',
  INVOICE_OVERDUE_30D:  '#dc2626',
};

const ACTION_COLORS = {
  SEND_RETRY_LINK:            C.blue,
  SEND_CART_RECOVERY:         C.violet,
  MANDATE_REACTIVATION:       C.cyan,
  PAYMENT_DATE_RESCHEDULING:  C.amber,
  SEND_INVOICE_REMINDER:      '#f97316',
  SEND_ESCALATION_NOTICE:     C.red,
  BLOCKED:                    C.slate,
};

const RULE_COLORS = {
  RULE_1_DISCOUNT_CAP:  C.emerald,
  RULE_2_RETRY_CAP:     C.red,
  RULE_3_QUIET_HOURS:   C.amber,
  RULE_4_DND:           C.slate,
  NONE:                 C.blue,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function computeDistribution(items, keyFn) {
  const map = {};
  for (const item of items) {
    const key = keyFn(item) || 'UNKNOWN';
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function computeAmountByCode(events) {
  const map = {};
  for (const ev of events) {
    const k = ev.failure_code || 'UNKNOWN';
    map[k] = (map[k] ?? 0) + ev.amount;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount }));
}

function parseRules(ruleStr) {
  if (!ruleStr || ruleStr === 'NONE' || ruleStr === '—') return [];
  return ruleStr.split('+').filter(r => r.startsWith('RULE_'));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section wrapper with a clean Razorpay-style header */
function Section({ title, subtitle, badge, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] shadow-sm p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-200">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {badge !== undefined && (
          <span className="rounded px-2.5 py-1 text-xs font-semibold bg-slate-800 text-slate-300">
            {badge}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Horizontal bar row */
function HBar({ label, count, total, color = C.blue, suffix = '' }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-44 text-[12px] truncate" style={{ color: '#94a3b8' }} title={label}>
        {label.replace(/_/g, ' ')}
      </span>
      <div className="flex-1 h-[5px] overflow-hidden" style={{ background: '#1e293b' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.6s ease' }} />
      </div>
      <span className="w-16 text-right text-[11px] font-mono" style={{ color: '#64748b' }}>
        {suffix || count}
      </span>
      <span className="w-10 text-right text-[11px] font-mono" style={{ color: '#475569' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/** Summary stat pill */
function StatPill({ label, value, color }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-[#111827] p-6 shadow-sm">
      <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-2xl font-bold mt-1" style={{ color }}>{value}</span>
    </div>
  );
}

/** Skeleton placeholder */
function Skeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-40 rounded shimmer" />
          <div className="h-[5px] flex-1 rounded shimmer" />
          <div className="h-3 w-10 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AnalyticsPanel
 * Displays 4 analytics sections computed from live API data:
 *   1. Failure Reason Distribution (by count)
 *   2. Revenue at Risk by Failure Code
 *   3. Recovery Action Distribution (from audit logs)
 *   4. Guardrail Interventions (from audit log rule_applied field)
 *
 * Props:
 *   lastRefreshed {number} — epoch timestamp; change triggers re-fetch
 */
export default function AnalyticsPanel({ lastRefreshed }) {
  const [events, setEvents] = useState([]);
  const [logs,   setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [evRes, loRes] = await Promise.all([
        fetch(`${API_BASE}/events`),
        fetch(`${API_BASE}/audit-logs`),
      ]);
      if (!evRes.ok || !loRes.ok) throw new Error('API error');
      const [evJson, loJson] = await Promise.all([evRes.json(), loRes.json()]);
      setEvents(evJson.data ?? []);
      setLogs(loJson.data ?? []);
    } catch (err) {
      setError('Could not load analytics data. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, [lastRefreshed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed metrics ─────────────────────────────────────────────────────────

  const failureDist   = computeDistribution(events, e => e.failure_code);
  const categoryDist  = computeDistribution(events, e => e.category);
  const statusDist    = computeDistribution(events, e => e.status);
  const amountByCode  = computeAmountByCode(events);
  const actionDist    = computeDistribution(
    logs.filter(l => l.chosen_action !== 'BLOCKED' && l.chosen_action !== '—'),
    l => l.chosen_action,
  );
  const guardDist     = (() => {
    const map = {};
    for (const log of logs) {
      for (const rule of parseRules(log.rule_applied)) {
        map[rule] = (map[rule] ?? 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  })();

  const totalEvents     = events.length;
  const totalRevAtRisk  = events.reduce((s, e) => s + e.amount, 0);
  const recoveredEvents = events.filter(e => e.status === 'RECOVERED');
  const totalRecovered  = recoveredEvents.reduce((s, e) => s + e.amount, 0);
  const totalLogs       = logs.length;
  const blockedLogs     = logs.filter(l => l.execution_status === 'BLOCKED' || l.execution_status === 'MAX_RETRIES_EXCEEDED').length;

  const maxFailCount  = failureDist[0]?.count  ?? 1;
  const maxActionCnt  = actionDist[0]?.count   ?? 1;
  const maxGuardCnt   = guardDist[0]?.count    ?? 1;
  const maxAmount     = amountByCode[0]?.amount ?? 1;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Page title row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Analytics &amp; Policy</h2>
          <p className="text-sm mt-1 text-slate-400">
            Recovery intelligence computed from live event and audit log data
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium transition hover:text-slate-200 hover:border-slate-600 text-slate-300">
          <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded border border-red-900/60 bg-red-950/40 px-4 py-3 text-[12px] text-red-400">
          <AlertCircle size={14} strokeWidth={2} />{error}
        </div>
      )}

      {/* ── Summary Stat Row ── */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatPill label="Total Events"       value={totalEvents}              color="#f8fafc" />
        <StatPill label="Revenue at Risk"    value={formatINR(totalRevAtRisk)} color={C.red}    />
        <StatPill label="Revenue Recovered"  value={formatINR(totalRecovered)} color={C.emerald} />
        <StatPill label="AI Interventions"   value={totalLogs}                color={C.blue}   />
      </div>

      {/* ── Row 1: Failure Distribution + Revenue by Code ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <Section
          title="Failure Reason Distribution"
          subtitle="Count of events per failure code"
          badge={`${totalEvents} events`}
        >
          {loading ? <Skeleton /> : failureDist.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#475569' }}>No events yet.</p>
          ) : failureDist.map(({ label, count }) => (
            <HBar key={label} label={label} count={count} total={maxFailCount}
              color={CATEGORY_COLORS[label] ?? C.slate} />
          ))}
        </Section>

        <Section
          title="Revenue at Risk by Failure Code"
          subtitle="Sum of failed amounts per failure type"
          badge={formatINR(totalRevAtRisk)}
        >
          {loading ? <Skeleton /> : amountByCode.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#475569' }}>No data.</p>
          ) : amountByCode.map(({ label, amount }) => (
            <HBar key={label} label={label} count={amount} total={maxAmount}
              color={CATEGORY_COLORS[label] ?? C.slate}
              suffix={formatINR(amount)} />
          ))}
        </Section>
      </div>

      {/* ── Row 2: Recovery Actions + Guardrail Interventions ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <Section
          title="Recovery Actions Dispatched"
          subtitle="From AI audit log — actions chosen by LLM agent"
          badge={`${totalLogs - blockedLogs} dispatched`}
        >
          {loading ? <Skeleton rows={4} /> : actionDist.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#475569' }}>
              No recovery actions logged yet. Run a batch simulation to generate data.
            </p>
          ) : actionDist.map(({ label, count }) => (
            <HBar key={label} label={label} count={count} total={maxActionCnt}
              color={ACTION_COLORS[label] ?? C.blue} />
          ))}
        </Section>

        <Section
          title="Guardrail Interventions"
          subtitle="Rules fired from pre-check and post-check phases"
          badge={`${blockedLogs} blocked`}
        >
          {loading ? <Skeleton rows={4} /> : guardDist.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#475569' }}>
              No guardrail rules have fired yet.
            </p>
          ) : guardDist.map(({ label, count }) => (
            <HBar key={label} label={label} count={count} total={maxGuardCnt}
              color={RULE_COLORS[label] ?? C.slate} />
          ))}

          {/* Legend */}
          {!loading && guardDist.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { rule: 'RULE_1_DISCOUNT_CAP', desc: 'Discount capped at 5%' },
                { rule: 'RULE_2_RETRY_CAP',    desc: 'Max retries exceeded' },
                { rule: 'RULE_3_QUIET_HOURS',  desc: 'Quiet hours — scheduled' },
                { rule: 'RULE_4_DND',          desc: 'Customer DND / opt-out' },
              ].map(({ rule, desc }) => (
                <div key={rule} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm shrink-0"
                    style={{ background: RULE_COLORS[rule] ?? C.slate }} />
                  <span className="text-[10px]" style={{ color: '#475569' }}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Row 3: Status Breakdown + Category Split ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <Section title="Event Status Breakdown" subtitle="Current status across all 18 seeded events">
          {loading ? <Skeleton rows={3} /> : statusDist.map(({ label, count }) => {
            const color = { RECOVERED: C.emerald, PROCESSING: C.amber, FAILED: C.red }[label] ?? C.slate;
            return <HBar key={label} label={label} count={count} total={totalEvents} color={color} />;
          })}
        </Section>

        <Section title="Category Distribution" subtitle="Events split by business segment">
          {loading ? <Skeleton rows={3} /> : categoryDist.map(({ label, count }) => {
            const color = { D2C_CHECKOUT: C.blue, SUBSCRIPTION_MANDATE: C.violet, B2B_INVOICE: C.amber }[label] ?? C.slate;
            return <HBar key={label} label={label.replace(/_/g, ' ')} count={count} total={totalEvents} color={color} />;
          })}
        </Section>
      </div>

      {/* ── Policy Summary ── */}
      <Section
        title="Active Safety Policy"
        subtitle="Guardrail rules enforced on every recovery request"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[
            {
              icon: TrendingUp,
              rule: 'Rule 1 — Max Discount Cap',
              desc: 'Discount offered is hard-capped at 5.0% regardless of LLM output. Any excess is silently trimmed in post-check.',
              color: C.emerald,
            },
            {
              icon: RefreshCw,
              rule: 'Rule 2 — Retry Limit',
              desc: 'Events with retry_count ≥ 2 are permanently blocked from automated recovery. Logged as MAX_RETRIES_EXCEEDED.',
              color: C.red,
            },
            {
              icon: Clock,
              rule: 'Rule 3 — Quiet Hours (22:00–08:00 IST)',
              desc: 'Recovery messages are not dispatched during quiet hours. They are scheduled for 09:00 AM IST and status set to PROCESSING.',
              color: C.amber,
            },
            {
              icon: Shield,
              rule: 'Rule 4 — DND / Opt-Out',
              desc: 'Customers whose email or phone contains OPT_OUT or DND are blocked at pre-check. Execution status set to BLOCKED.',
              color: C.slate,
            },
          ].map(({ icon: Icon, rule, desc, color }) => (
            <div key={rule} className="rounded border p-4 flex gap-3"
              style={{ borderColor: '#1e293b', background: '#0b0f19' }}>
              <div className="mt-0.5 shrink-0 h-6 w-6 flex items-center justify-center rounded"
                style={{ background: `${color}15` }}>
                <Icon size={13} style={{ color }} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-300">{rule}</p>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
