import React, { useEffect, useState } from 'react';
import {
  X, User, Mail, Phone, CreditCard, AlertTriangle,
  Calendar, Hash, BotMessageSquare, ClipboardList,
  CheckCircle2, Clock, XCircle, ChevronRight,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(new Date(iso));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value, mono = false, accent }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800">
        <Icon size={13} className="text-slate-400" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-600">{label}</p>
        <p className={`mt-0.5 text-sm font-medium break-words ${mono ? 'font-mono' : ''}`}
          style={{ color: accent ?? '#e2e8f0' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function AuditLogCard({ log, index }) {
  const statusIcon = {
    SUCCESS: <CheckCircle2 size={14} className="text-emerald-400" strokeWidth={2.5} />,
    PENDING: <Clock        size={14} className="text-amber-400"   strokeWidth={2.5} />,
    FAILED:  <XCircle      size={14} className="text-red-400"     strokeWidth={2.5} />,
  }[log.execution_status] ?? <Clock size={14} className="text-slate-400" strokeWidth={2} />;

  return (
    <div className="relative pl-5 animate-fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Timeline line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-700" />
      {/* Timeline dot */}
      <div className="absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-slate-900" />

      <div className="ml-4 mb-4 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-xs font-semibold text-slate-200">{log.chosen_action}</span>
          </div>
          <span className="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            Risk: {(log.risk_score ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Message */}
        {log.message_content && (
          <p className="mb-3 rounded-md bg-slate-900/70 px-3 py-2 text-xs italic text-slate-400 border border-slate-700/60 leading-relaxed">
            "{log.message_content}"
          </p>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-600">Rule</span>
            <p className="mt-0.5 font-mono text-slate-400">{log.rule_applied || '—'}</p>
          </div>
          <div>
            <span className="text-slate-600">Category</span>
            <p className="mt-0.5 text-slate-400">{log.failure_category || '—'}</p>
          </div>
          {log.discount_offered > 0 && (
            <div>
              <span className="text-slate-600">Discount</span>
              <p className="mt-0.5 font-semibold text-emerald-400">{formatINR(log.discount_offered)}</p>
            </div>
          )}
          <div>
            <span className="text-slate-600">Logged At</span>
            <p className="mt-0.5 text-slate-500 text-[10px]">{formatDate(log.timestamp)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AuditLogDrawer
 * Slide-in panel showing event details + step-by-step AI intervention logs.
 *
 * Props:
 *   eventId   {string|null}  — ID to inspect (null = closed)
 *   onClose   {function}     — called when drawer closes
 */
export default function AuditLogDrawer({ eventId, onClose }) {
  const [data,    setData]    = useState(null);   // { event, audit_logs }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!eventId) { setData(null); return; }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res  = await fetch(`${API_BASE}/events/${eventId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        setError('Could not load event details. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // ── Keyboard Close ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Lock body scroll when drawer is open ──────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = eventId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [eventId]);

  if (!eventId) return null;

  const ev   = data?.event;
  const logs = data?.audit_logs ?? [];

  const statusColor = {
    FAILED:     '#f87171',
    RECOVERED:  '#34d399',
    PROCESSING: '#fbbf24',
  }[ev?.status] ?? '#94a3b8';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Audit Log Drawer"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-slate-700 bg-slate-900 animate-slide-in shadow-2xl"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/25">
              <ClipboardList size={16} className="text-blue-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Event Audit Log</h2>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{eventId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition active:scale-90"
            aria-label="Close drawer"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">

          {loading && (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg shimmer" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="m-5 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-400">
              <AlertTriangle size={16} strokeWidth={2} />{error}
            </div>
          )}

          {!loading && !error && ev && (
            <>
              {/* ── Event Details Section ── */}
              <div className="px-5 pt-5">
                <div className="mb-4 flex items-center gap-2">
                  <ChevronRight size={12} className="text-blue-400" strokeWidth={3} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">
                    Event Details
                  </span>
                </div>

                {/* Status pill */}
                <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5">
                  <span className="text-xs text-slate-500">Current Status</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: statusColor }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: statusColor }} />
                    {ev.status}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-800/30 px-4">
                  <DetailRow icon={User}          label="Customer Name"  value={ev.customer_name} />
                  <DetailRow icon={Mail}          label="Email"          value={ev.customer_email} />
                  <DetailRow icon={Phone}         label="Phone"          value={ev.customer_phone} />
                  <DetailRow icon={CreditCard}    label="Amount At Risk" value={formatINR(ev.amount)} accent="#f87171" />
                  <DetailRow icon={Hash}          label="Payment Method" value={ev.payment_method} mono />
                  <DetailRow icon={AlertTriangle} label="Failure Code"   value={ev.failure_code}   mono accent="#fb923c" />
                  <DetailRow icon={Calendar}      label="Created At"     value={formatDate(ev.created_at)} />
                </div>
              </div>

              {/* ── AI Intervention Logs Section ── */}
              <div className="px-5 pt-6 pb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight size={12} className="text-cyan-400" strokeWidth={3} />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
                      AI Interventions
                    </span>
                  </div>
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-500/25 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400">
                    {logs.length} log{logs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {logs.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-700 py-10 text-center">
                    <BotMessageSquare size={32} strokeWidth={1.2} className="text-slate-700" />
                    <p className="text-sm font-medium text-slate-500">No AI interventions yet</p>
                    <p className="text-xs text-slate-600 max-w-[240px] leading-relaxed">
                      The AI engine will log recovery actions here once Module 2 processes this event.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {logs.map((log, i) => (
                      <AuditLogCard key={log.id} log={log} index={i} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
