import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, ChevronUp, ChevronDown, FileSearch, AlertCircle,
  Inbox, Zap, Loader2, CheckCircle2, XCircle, AlertTriangle,
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
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

// ─── Badge Configs ────────────────────────────────────────────────────────────

const CATEGORY_BADGE = {
  D2C_CHECKOUT:         { label: 'D2C Checkout', bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
  SUBSCRIPTION_MANDATE: { label: 'Subscription', bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)'  },
  B2B_INVOICE:          { label: 'B2B Invoice',  bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)'  },
};

const STATUS_BADGE = {
  FAILED:     { label: 'Failed',     bg: 'rgba(239,68,68,0.15)',  color: '#f87171', border: 'rgba(239,68,68,0.3)',  dot: '#ef4444' },
  RECOVERED:  { label: 'Recovered',  bg: 'rgba(52,211,153,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.3)', dot: '#10b981' },
  PROCESSING: { label: 'Scheduled',  bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)', dot: '#f59e0b' },
  BLOCKED:    { label: 'Blocked',    bg: 'rgba(244,63,94,0.15)',  color: '#fb7185', border: 'rgba(244,63,94,0.3)',  dot: '#f43f5e' },
};

function CategoryBadge({ category }) {
  const cfg = CATEGORY_BADGE[category] ?? { label: category, bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' };
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)', dot: '#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── Toast Notification ───────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const styles = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#34d399', Icon: CheckCircle2 },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: '#f87171', Icon: XCircle },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: '#fbbf24', Icon: AlertTriangle },
  };
  const s = styles[toast.type] ?? styles.success;
  const { Icon } = s;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in max-w-sm"
      style={{ animation: 'slideInRight 0.3s cubic-bezier(0.22,1,0.36,1) both' }}>
      <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 shadow-2xl"
        style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: 'blur(12px)' }}>
        <Icon size={16} style={{ color: s.color, marginTop: 1 }} strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: s.color }}>{toast.title}</p>
          {toast.body && <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{toast.body}</p>}
        </div>
        <button onClick={onDismiss} className="text-slate-600 hover:text-slate-300 transition ml-1 shrink-0">
          <XCircle size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[160, 100, 80, 90, 90, 80, 110, 80, 100].map((w, i) => (
        <td key={i} className="px-6 py-4"><div className="h-4 rounded shimmer" style={{ width: w }} /></td>
      ))}
    </tr>
  );
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronUp size={12} className="text-slate-600" />;
  return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />;
}

const COLUMNS = [
  { key: 'customer_name',  label: 'Customer',      sortable: true  },
  { key: 'category',       label: 'Category',      sortable: true  },
  { key: 'amount',         label: 'Amount',        sortable: true  },
  { key: 'payment_method', label: 'Method',        sortable: false },
  { key: 'failure_code',   label: 'Failure Code',  sortable: false },
  { key: 'status',         label: 'Status',        sortable: true  },
  { key: 'created_at',     label: 'Date',          sortable: true  },
  { key: '_inspect',       label: 'Audit',         sortable: false },
  { key: '_recover',       label: 'AI Recover',    sortable: false },
];

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * EventTable
 * Props:
 *   category         {string}    — category filter value
 *   onInspect        {function}  — called with event id to open AuditLogDrawer
 *   onCountsChange   {function}  — sends category count map to parent
 *   lastRefreshed    {number}    — timestamp; change triggers re-fetch
 *   onRecoverSuccess {function}  — called after a successful recovery (triggers metrics refresh)
 */
export default function EventTable({ category, onInspect, onCountsChange, lastRefreshed, onRecoverSuccess }) {
  const [events,      setEvents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [sortField,   setSortField]   = useState('created_at');
  const [sortDir,     setSortDir]     = useState('desc');
  const [recovering,  setRecovering]  = useState(new Set()); // Set of IDs currently being processed
  const [rowStatuses, setRowStatuses] = useState({});        // { [id]: 'RECOVERED' | 'PROCESSING' | 'BLOCKED' }
  const [toast,       setToast]       = useState(null);

  // ── Fetch Events ───────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [filtRes, allRes] = await Promise.all([
        fetch(`${API_BASE}/events${category ? `?category=${encodeURIComponent(category)}` : ''}`),
        fetch(`${API_BASE}/events`),
      ]);
      if (!filtRes.ok || !allRes.ok) throw new Error('API error');
      const [filtJson, allJson] = await Promise.all([filtRes.json(), allRes.json()]);
      setEvents(filtJson.data ?? []);
      setRowStatuses({});   // clear local overrides after full re-fetch

      if (onCountsChange) {
        const all = allJson.data ?? [];
        const counts = { '': all.length };
        for (const ev of all) counts[ev.category] = (counts[ev.category] ?? 0) + 1;
        onCountsChange(counts);
      }
    } catch {
      setError('Failed to load events. Is the server running on port 5000?');
    } finally {
      setLoading(false);
    }
  }, [category, lastRefreshed]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Recovery Handler ───────────────────────────────────────────────────────

  const handleRecover = useCallback(async (ev) => {
    if (recovering.has(ev.id)) return;

    setRecovering(prev => new Set(prev).add(ev.id));

    try {
      const res  = await fetch(`${API_BASE}/recover/${ev.id}`, { method: 'POST' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Recovery failed');
      }

      if (json.blocked) {
        // Guardrail blocked the action (DND or Max Retries)
        setRowStatuses(prev => ({ ...prev, [ev.id]: 'BLOCKED' }));
        setToast({
          type:  'warning',
          title: 'Recovery Blocked by Guardrail',
          body:  json.message,
        });
      } else {
        // Success — update row status locally for instant UI feedback
        const newStatus = json.data?.event?.status ?? 'RECOVERED';
        setRowStatuses(prev => ({ ...prev, [ev.id]: newStatus }));
        setToast({
          type:  'success',
          title: newStatus === 'PROCESSING' ? 'Scheduled for 09:00 AM IST' : '✅ Recovery Pipeline Complete',
          body:  `Action: ${json.data?.audit_log?.chosen_action} · Discount: ${json.data?.audit_log?.discount_offered}%`,
        });
        // Trigger KPI metrics refresh in parent
        onRecoverSuccess?.();
      }
    } catch (err) {
      setToast({ type: 'error', title: 'Recovery Failed', body: err.message });
    } finally {
      setRecovering(prev => {
        const next = new Set(prev);
        next.delete(ev.id);
        return next;
      });
    }
  }, [recovering, onRecoverSuccess]);

  // ── Sort & Filter ──────────────────────────────────────────────────────────

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const displayEvents = [...events]
    .filter(ev => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ev.customer_name?.toLowerCase().includes(q) ||
        ev.customer_email?.toLowerCase().includes(q) ||
        ev.failure_code?.toLowerCase().includes(q) ||
        ev.payment_method?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aV = a[sortField], bV = b[sortField];
      const cmp = typeof aV === 'number' ? aV - bV : String(aV ?? '').localeCompare(String(bV ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-[#111827] shadow-sm overflow-hidden p-6">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Payment Failure Events</h2>
            <p className="mt-1 text-sm text-slate-400">
              {loading ? 'Loading…' : `${displayEvents.length} of ${events.length} events shown`}
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, email, code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 w-60"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-400">
            <AlertCircle size={15} strokeWidth={2} />{error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                {COLUMNS.map(({ key, label, sortable }) => (
                  <th key={key}
                    onClick={sortable ? () => handleSort(key) : undefined}
                    className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap ${sortable ? 'cursor-pointer select-none hover:text-slate-200' : ''}`}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortable && <SortIcon field={key} sortField={sortField} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayEvents.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Inbox size={36} strokeWidth={1.2} className="text-slate-700" />
                      <p className="text-sm font-medium">No events found</p>
                      <p className="text-xs">Try adjusting the search or category filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayEvents.map(ev => {
                  // Merge local status overrides (post-recovery instant feedback)
                  const localStatus   = rowStatuses[ev.id] ?? ev.status;
                  const isRecovering  = recovering.has(ev.id);
                  const isActionable  = localStatus === 'FAILED' || localStatus === 'PROCESSING';

                  return (
                    <tr key={ev.id} className={`table-row-hover transition-colors ${localStatus === 'RECOVERED' ? 'bg-emerald-950/10' : ''}`}>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-200 truncate max-w-[160px]" title={ev.customer_name}>{ev.customer_name}</p>
                        <p className="mt-1 text-xs text-slate-400 truncate max-w-[160px]" title={ev.customer_email}>{ev.customer_email}</p>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4"><CategoryBadge category={ev.category} /></td>

                      {/* Amount */}
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-200 whitespace-nowrap">{formatINR(ev.amount)}</td>

                      {/* Payment Method */}
                      <td className="px-6 py-4">
                        <span className="rounded bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300 border border-slate-700">{ev.payment_method}</span>
                      </td>

                      {/* Failure Code */}
                      <td className="px-6 py-4">
                        <span className="rounded bg-red-950/50 px-2.5 py-1 text-xs font-mono text-red-400 border border-red-900/40">{ev.failure_code}</span>
                      </td>

                      {/* Status (uses local override for instant feedback) */}
                      <td className="px-6 py-4"><StatusBadge status={localStatus} /></td>

                      {/* Date */}
                      <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(ev.created_at)}</td>

                      {/* Inspect Button */}
                      <td className="px-6 py-4">
                        <button
                          id={`inspect-${ev.id}`}
                          onClick={() => onInspect(ev.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20 hover:border-blue-400 hover:text-blue-300 active:scale-95 whitespace-nowrap">
                          <FileSearch size={14} strokeWidth={2.5} />
                          Inspect
                        </button>
                      </td>

                      {/* Recover via AI Button */}
                      <td className="px-6 py-4">
                        {localStatus === 'RECOVERED' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                            <CheckCircle2 size={13} strokeWidth={2.5} />
                            Recovered
                          </span>
                        ) : localStatus === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                            <XCircle size={13} strokeWidth={2} />
                            Blocked
                          </span>
                        ) : (
                          <button
                            id={`recover-${ev.id}`}
                            onClick={() => handleRecover(ev)}
                            disabled={isRecovering || !isActionable}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition whitespace-nowrap active:scale-95
                              ${isRecovering
                                ? 'border-cyan-500/20 bg-cyan-500/8 text-cyan-500/60 cursor-not-allowed'
                                : 'border-cyan-500/40 bg-cyan-500/12 text-cyan-400 hover:bg-cyan-500/22 hover:border-cyan-400 hover:text-cyan-300 cursor-pointer'
                              }`}
                            style={{ boxShadow: isRecovering ? 'none' : '0 0 8px rgba(6,182,212,0.12)' }}
                          >
                            {isRecovering ? (
                              <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                            ) : (
                              <Zap size={12} strokeWidth={2.5} />
                            )}
                            {isRecovering ? 'Recovering…' : 'Recover via AI'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && displayEvents.length > 0 && (
          <div className="border-t border-slate-800 pt-4 mt-4 text-sm text-slate-400">
            Showing {displayEvents.length} event{displayEvents.length !== 1 ? 's' : ''}{search && ` matching "${search}"`}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
