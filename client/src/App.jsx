import React, { useState, useCallback } from 'react';
import { Shield, Cpu, Activity, BarChart3, LayoutDashboard, Github } from 'lucide-react';
import MetricsHeader  from './components/MetricsHeader';
import CategoryFilter from './components/CategoryFilter';
import EventTable     from './components/EventTable';
import BatchSimulator from './components/BatchSimulator';
import AnalyticsPanel from './components/AnalyticsPanel';
import AuditModal     from './components/AuditModal';

// ─── Nav tab config ────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'dashboard', label: 'Command Centre',     Icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics & Policy', Icon: BarChart3       },
];

// ─── Styles (Razorpay palette, no glow) ──────────────────────────────────────

const S = {
  bg:         '#0b0f19',
  surface:    '#111827',
  border:     '#1e293b',
  textMuted:  '#64748b',
  textSub:    '#94a3b8',
  blue:       '#3b82f6',
};

export default function App() {
  const [view,             setView]             = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inspectId,        setInspectId]        = useState(null);
  const [counts,           setCounts]           = useState({});
  const [lastRefreshed,    setLastRefreshed]    = useState(Date.now());

  const handleRefresh  = useCallback(() => setLastRefreshed(Date.now()), []);
  const handleInspect  = useCallback((id) => setInspectId(id), []);
  const handleClose    = useCallback(() => setInspectId(null), []);
  const handleCounts   = useCallback((c) => setCounts(c), []);

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>

      {/* ─────────────────────────── Top Header ──────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ background: 'rgba(11,15,25,0.96)', borderColor: S.border, backdropFilter: 'blur(8px)' }}
      >
        {/* Brand row */}
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-3">

          {/* Logo + brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded"
              style={{ background: '#1e3a5f', border: '1px solid #2563eb' }}
            >
              <Shield size={16} className="text-blue-400" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight">
                <span className="gradient-text">RazorShield AI</span>
              </h1>
              <p className="text-[10px] leading-none" style={{ color: S.textMuted }}>
                Autonomous Revenue Recovery · Razorpay Buildathon Track 03
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Gemini mode tag */}
            <div
              className="hidden sm:flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium"
              style={{ background: '#0d2137', border: '1px solid #1d4ed8', color: '#93c5fd' }}
            >
              <Cpu size={11} strokeWidth={2.5} />
              Gemini AI
            </div>

            {/* API status */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px]" style={{ color: S.textMuted }}>
              <Activity size={11} className="text-emerald-500" strokeWidth={2.5} />
              Live
            </div>

            {/* GitHub */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded border transition hover:border-slate-600 hover:text-slate-300"
              style={{ borderColor: S.border, color: S.textMuted }}
              aria-label="GitHub"
            >
              <Github size={14} strokeWidth={2} />
            </a>
          </div>
        </div>

        {/* ── View navigation tabs (Razorpay dashboard style) ── */}
        <div
          className="mx-auto flex max-w-screen-2xl items-end gap-0 px-5"
          role="tablist"
          aria-label="Application views"
        >
          {VIEWS.map(({ id, label, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setView(id)}
                className="flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 focus:outline-none"
                style={{
                  borderBottomColor: active ? S.blue : 'transparent',
                  color:             active ? '#e2e8f0' : S.textMuted,
                  background:        'transparent',
                }}
              >
                <Icon size={14} strokeWidth={2} style={{ color: active ? S.blue : S.textMuted }} />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ─────────────────────────── Main Content ────────────────────────── */}
      <main className="w-full px-6 py-6 space-y-6">

        {view === 'dashboard' && (
          <div className="flex flex-col gap-6">
            {/* ── KPI Cards ── */}
            <MetricsHeader onRefresh={handleRefresh} lastRefreshed={lastRefreshed} />

            {/* ── Batch Simulator ── */}
            <BatchSimulator onBatchComplete={handleRefresh} />

            {/* ── Filter Bar ── */}
            <div className="flex flex-wrap items-center gap-3">
              <CategoryFilter
                selected={selectedCategory}
                onChange={setSelectedCategory}
                counts={counts}
              />
            </div>

            {/* ── Events Table ── */}
            <EventTable
              category={selectedCategory}
              onInspect={handleInspect}
              onCountsChange={handleCounts}
              lastRefreshed={lastRefreshed}
              onRecoverSuccess={handleRefresh}
            />
          </div>
        )}

        {view === 'analytics' && (
          <AnalyticsPanel lastRefreshed={lastRefreshed} />
        )}
      </main>

      {/* ─────────────────────────── Footer ──────────────────────────────── */}
      <footer
        className="border-t px-5 py-4 text-center text-[11px]"
        style={{ borderColor: S.border, color: '#334155' }}
      >
        RazorShield AI — Built for{' '}
        <span style={{ color: S.blue, fontWeight: 600 }}>Razorpay Buildathon 2026</span>
        {' '}· Track 03: AI-Powered Revenue Recovery Engine
      </footer>

      {/* ─────────────────────────── Audit Modal ─────────────────────────── */}
      <AuditModal eventId={inspectId} onClose={handleClose} />
    </div>
  );
}
