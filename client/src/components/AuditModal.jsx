import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, ChevronRight, Copy, Check } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v ?? 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(new Date(iso));
}

function parsePreRules(ruleStr) {
  if (!ruleStr || ruleStr === 'NONE' || ruleStr === '—') return [];
  return ruleStr.split('+').filter(r => r.startsWith('RULE_'));
}

function parseEngineRule(ruleStr) {
  if (!ruleStr) return null;
  const parts = ruleStr.split('+');
  return parts.find(r => r.startsWith('MOCK_') || r.startsWith('LLM_'));
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  SUCCESS:              { label: 'Success',         color: '#10b981', bg: '#052e16', border: '#14532d' },
  SCHEDULED:            { label: 'Scheduled',       color: '#f59e0b', bg: '#431407', border: '#78350f' },
  BLOCKED:              { label: 'Blocked',         color: '#ef4444', bg: '#450a0a', border: '#7f1d1d' },
  MAX_RETRIES_EXCEEDED: { label: 'Retries Exceeded',color: '#ef4444', bg: '#450a0a', border: '#7f1d1d' },
  RECOVERED:            { label: 'Recovered',       color: '#10b981', bg: '#052e16', border: '#14532d' },
  PROCESSING:           { label: 'Processing',      color: '#f59e0b', bg: '#431407', border: '#78350f' },
  FAILED:               { label: 'Failed',          color: '#ef4444', bg: '#450a0a', border: '#7f1d1d' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#94a3b8', bg: '#0f172a', border: '#1e293b' };
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

// ─── Event info row ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono, accent }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b"
      style={{ borderColor: '#1e293b' }}>
      <span className="text-[11px] uppercase tracking-wider shrink-0" style={{ color: '#475569' }}>{label}</span>
      <span className={`text-[12px] text-right ${mono ? 'font-mono' : 'font-medium'}`}
        style={{ color: accent ?? '#cbd5e1' }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── 3-Step Timeline ──────────────────────────────────────────────────────────

/**
 * Parses a single audit log into 3 logical pipeline steps.
 */
function buildSteps(log) {
  const preRules   = parsePreRules(log.rule_applied);
  const engineRule = parseEngineRule(log.rule_applied);

  const isBlocked  = log.execution_status === 'BLOCKED' || log.execution_status === 'MAX_RETRIES_EXCEEDED';
  const isScheduled = log.execution_status === 'SCHEDULED';

  const step1Status = preRules.length > 0 || isBlocked ? (isBlocked ? 'BLOCKED' : 'MODIFIED') : 'PASS';
  const step2Status = isBlocked ? 'SKIPPED' : 'PASS';
  const step3Status = isBlocked ? 'SKIPPED' : 'PASS';

  return [
    {
      step: 1,
      title: 'Guardrail Pre-Check',
      subtitle: 'Safety rules evaluated before LLM is called',
      status: step1Status,
      details: preRules.length > 0
        ? preRules.map(r => ({
            key: r,
            value: {
              RULE_2_RETRY_CAP:   'Blocked — retry count ≥ 2',
              RULE_3_QUIET_HOURS: 'Scheduled — quiet hours (22:00–08:00 IST)',
              RULE_4_DND:         'Blocked — customer is on DND/OPT_OUT list',
            }[r] ?? 'Rule applied',
          }))
        : [{ key: 'Result', value: 'All checks passed — proceeding to AI engine' }],
    },
    {
      step: 2,
      title: 'AI Reasoning Engine',
      subtitle: engineRule?.startsWith('LLM_GEMINI') ? 'Gemini 1.5 Flash' :
                engineRule?.startsWith('LLM_OPENAI') ? 'GPT-4o Mini' : 'Mock Rule-Based Engine',
      status: step2Status,
      details: isBlocked ? [{ key: 'Skipped', value: 'Blocked by guardrail pre-check' }] : [
        { key: 'Failure Category',  value: log.failure_category },
        { key: 'Risk Score',        value: log.risk_score?.toFixed(2) ?? '—', accent: log.risk_score > 0.8 ? '#ef4444' : '#f59e0b' },
        { key: 'Chosen Action',     value: log.chosen_action },
        { key: 'Discount Offered',  value: log.discount_offered > 0 ? `${log.discount_offered}%` : 'None' },
        { key: 'Reasoning',         value: log.failure_category
            ? `Diagnosed as ${log.failure_category} failure — ${log.chosen_action.toLowerCase().replace(/_/g, ' ')} strategy selected.`
            : '—' },
      ],
      message: !isBlocked ? log.message_content : null,
    },
    {
      step: 3,
      title: 'Safety Post-Check',
      subtitle: 'Discount cap enforcement and final status assignment',
      status: step3Status,
      details: isBlocked ? [{ key: 'Skipped', value: 'Not reached due to pre-check block' }] : [
        { key: 'Discount Cap',    value: log.discount_offered > 0 ? `${log.discount_offered}% applied (cap: 5%)` : 'Not applicable' },
        { key: 'Final Status',    value: log.execution_status },
        { key: 'Logged At',       value: formatDate(log.timestamp) },
      ],
    },
  ];
}

const STEP_STATUS_CFG = {
  PASS:     { icon: CheckCircle2, color: '#10b981', label: 'Passed'  },
  MODIFIED: { icon: AlertTriangle, color: '#f59e0b', label: 'Modified' },
  BLOCKED:  { icon: X,            color: '#ef4444', label: 'Blocked' },
  SKIPPED:  { icon: Clock,        color: '#475569', label: 'Skipped' },
};

function TimelineStep({ step, title, subtitle, status, details, message, isLast }) {
  const cfg = STEP_STATUS_CFG[status] ?? STEP_STATUS_CFG.PASS;
  const Icon = cfg.icon;

  return (
    <div className="flex gap-4">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: cfg.color, background: `${cfg.color}12` }}>
          <Icon size={13} style={{ color: cfg.color }} strokeWidth={2.5} />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1" style={{ background: '#1e293b', minHeight: 24 }} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
            Step {step}
          </span>
          <ChevronRight size={10} style={{ color: '#334155' }} />
          <span className="text-[12px] font-semibold text-slate-200">{title}</span>
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: `${cfg.color}15`, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <p className="text-[11px] mb-3" style={{ color: '#475569' }}>{subtitle}</p>

        <div className="rounded border" style={{ borderColor: '#1e293b', background: '#0b0f19' }}>
          {details.map(({ key, value, accent }, i) => (
            <div key={key}
              className={`flex items-start justify-between gap-4 px-3 py-2 text-[11px] ${i < details.length - 1 ? 'border-b' : ''}`}
              style={{ borderColor: '#1e293b' }}>
              <span style={{ color: '#475569' }}>{key}</span>
              <span className="text-right font-medium max-w-[60%]" style={{ color: accent ?? '#94a3b8' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Customer message preview */}
        {message && (
          <div className="mt-2 rounded border px-3 py-2.5" style={{ borderColor: '#1e293b', background: '#0b0f19' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>
              Recovery Message Sent
            </p>
            <p className="text-[12px] italic leading-relaxed" style={{ color: '#64748b' }}>
              "{message}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── JSON Viewer ──────────────────────────────────────────────────────────────

function JsonViewer({ data }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  function copy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Minimal syntax highlighting via regex replace — no external deps
  const highlighted = json
    .replace(/(".*?")(\s*:)/g, '<span style="color:#93c5fd">$1</span>$2')    // keys
    .replace(/:\s*(".*?")/g,    ':<span style="color:#86efac"> $1</span>')    // string values
    .replace(/:\s*(\d+\.?\d*)/g,':<span style="color:#fbbf24"> $1</span>')    // numbers
    .replace(/:\s*(true|false)/g,':<span style="color:#f472b6"> $1</span>')   // booleans
    .replace(/:\s*(null)/g,     ':<span style="color:#94a3b8"> $1</span>');   // null

  return (
    <div className="rounded border" style={{ borderColor: '#1e293b' }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: '#1e293b', background: '#0b0f19' }}>
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
          Raw JSON — Full Audit Record
        </span>
        <button onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition hover:text-slate-300"
          style={{ color: copied ? '#10b981' : '#64748b' }}>
          {copied ? <Check size={11} strokeWidth={3} /> : <Copy size={11} strokeWidth={2} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="code-block overflow-x-auto px-4 py-4 text-[12px] leading-relaxed"
        style={{ background: '#080e1a', maxHeight: 320, color: '#cbd5e1' }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'rgba(7,10,22,0.82)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="animate-slide-in-up relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border shadow-2xl"
          style={{ background: '#111827', borderColor: '#1e293b', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AuditModal
 * Full-screen centered modal showing event details + 3-step pipeline timeline
 * + raw JSON viewer for every audit log entry.
 *
 * Props:
 *   eventId  {string|null}  — payment event ID to inspect; null = closed
 *   onClose  {function}     — dismiss callback
 */
export default function AuditModal({ eventId, onClose }) {
  const [data,    setData]    = useState(null);   // { event, audit_logs }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [activeLog, setActiveLog] = useState(0); // index into audit_logs

  useEffect(() => {
    if (!eventId) { setData(null); setActiveLog(0); return; }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res  = await fetch(`${API_BASE}/events/${eventId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data);
        setActiveLog(0);
      } catch (err) {
        setError('Could not load event details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  if (!eventId) return null;

  const ev   = data?.event;
  const logs = data?.audit_logs ?? [];
  const log  = logs[activeLog] ?? null;
  const steps = log ? buildSteps(log) : [];

  return (
    <ModalShell onClose={onClose}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b px-5 py-4 shrink-0"
        style={{ borderColor: '#1e293b' }}>
        <div>
          <h2 className="text-sm font-bold text-slate-100">Transaction Audit Log</h2>
          <p className="mt-0.5 text-[10px] font-mono" style={{ color: '#475569' }}>
            {eventId}
          </p>
        </div>
        <button onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded border transition hover:border-slate-600 hover:text-slate-200"
          style={{ borderColor: '#1e293b', color: '#64748b' }}>
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {loading && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded shimmer" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="m-5 flex items-center gap-3 rounded border border-red-900/50 bg-red-950/30 px-4 py-3 text-[12px] text-red-400">
            <AlertTriangle size={14} strokeWidth={2} />{error}
          </div>
        )}

        {!loading && !error && ev && (
          <div className="p-5 space-y-5">

            {/* ── Event Summary ── */}
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#3b82f6' }}>
                Payment Event
              </p>
              <div className="rounded border" style={{ borderColor: '#1e293b', background: '#0b0f19' }}>
                <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#1e293b' }}>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Customer</p>
                    <p className="text-[13px] font-semibold text-slate-200">{ev.customer_name}</p>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>{ev.customer_email}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Amount at Risk</p>
                    <p className="text-[13px] font-semibold" style={{ color: '#ef4444' }}>
                      {formatINR(ev.amount)}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: '#64748b' }}>{ev.failure_code}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-2.5"
                  style={{ borderColor: '#1e293b' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono rounded px-2 py-0.5"
                      style={{ background: '#1e293b', color: '#94a3b8' }}>
                      {ev.payment_method}
                    </span>
                    <span className="text-[11px]" style={{ color: '#475569' }}>
                      {ev.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <StatusBadge status={ev.status} />
                </div>
              </div>
            </div>

            {/* ── Audit Log Selector (if multiple logs) ── */}
            {logs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded border border-dashed py-10 text-center"
                style={{ borderColor: '#1e293b' }}>
                <Clock size={28} strokeWidth={1.2} style={{ color: '#1e293b' }} />
                <p className="text-[12px] font-medium" style={{ color: '#475569' }}>No AI interventions logged yet</p>
                <p className="text-[11px]" style={{ color: '#334155' }}>
                  Click "Recover via AI" or run a batch simulation to generate audit entries.
                </p>
              </div>
            ) : (
              <>
                {logs.length > 1 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#475569' }}>
                      Intervention Log ({logs.length} entries)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {logs.map((l, i) => (
                        <button key={l.id} onClick={() => setActiveLog(i)}
                          className="rounded border px-3 py-1.5 text-[11px] font-medium transition"
                          style={{
                            borderColor: activeLog === i ? '#3b82f6' : '#1e293b',
                            background:  activeLog === i ? '#1e3a5f' : '#0b0f19',
                            color:       activeLog === i ? '#93c5fd' : '#64748b',
                          }}>
                          #{i + 1} — {l.chosen_action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 3-Step Timeline ── */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-4" style={{ color: '#475569' }}>
                    Recovery Pipeline — Step by Step
                  </p>
                  <div className="space-y-0">
                    {steps.map((s, i) => (
                      <TimelineStep key={s.step} {...s} isLast={i === steps.length - 1} />
                    ))}
                  </div>
                </div>

                {/* ── JSON Viewer ── */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#475569' }}>
                    Developer Inspection
                  </p>
                  <JsonViewer data={log} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {!loading && ev && (
        <div className="flex items-center justify-between border-t px-5 py-3 shrink-0"
          style={{ borderColor: '#1e293b' }}>
          <span className="text-[10px]" style={{ color: '#334155' }}>
            {logs.length} intervention{logs.length !== 1 ? 's' : ''} recorded
          </span>
          <button onClick={onClose}
            className="rounded border px-4 py-1.5 text-[12px] font-medium transition hover:text-slate-200"
            style={{ borderColor: '#1e293b', color: '#64748b' }}>
            Close
          </button>
        </div>
      )}
    </ModalShell>
  );
}
