import React, { useState, useCallback } from 'react';
import { Shield, Cpu, Github, Activity } from 'lucide-react';
import MetricsHeader    from './components/MetricsHeader';
import CategoryFilter   from './components/CategoryFilter';
import EventTable       from './components/EventTable';
import AuditLogDrawer   from './components/AuditLogDrawer';
import BatchSimulator   from './components/BatchSimulator';

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inspectId,        setInspectId]        = useState(null);
  const [counts,           setCounts]            = useState({});
  const [lastRefreshed,    setLastRefreshed]     = useState(Date.now());

  const handleRefresh  = useCallback(() => setLastRefreshed(Date.now()), []);
  const handleInspect  = useCallback((id) => setInspectId(id), []);
  const handleClose    = useCallback(() => setInspectId(null), []);
  const handleCounts   = useCallback((c) => setCounts(c), []);

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>

      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 backdrop-blur-md"
        style={{ background: 'rgba(11,17,32,0.92)' }}>
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-3.5">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', boxShadow: '0 0 18px rgba(59,130,246,0.4)' }}>
              <Shield size={18} className="text-white" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
              </span>
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">
                <span className="gradient-text">RazorShield AI</span>
              </h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">
                Autonomous Revenue Recovery Engine
              </p>
            </div>
          </div>

          {/* Center badge */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5">
            <Cpu size={12} className="text-blue-400" strokeWidth={2.5} />
            <span className="text-[11px] font-semibold text-slate-400">
              Razorpay Buildathon — Track 03
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
              <Activity size={12} className="text-emerald-400" strokeWidth={2.5} />
              <span>API Connected</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition"
              aria-label="GitHub"
            >
              <Github size={15} strokeWidth={2} />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-slate-800/40"
        style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%)' }}>
        {/* Background grid decoration */}
        <div className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(59,130,246,0.4) 1px, transparent 1px), linear-gradient(90deg,rgba(59,130,246,0.4) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        <div className="mx-auto max-w-screen-2xl px-5 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/70 mb-1">
            Modules 1–4 — Live Dashboard
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 mb-1">
            Revenue Recovery Command Centre
          </h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Monitor failures, trigger individual or bulk AI recovery, inspect every guardrail decision, and reclaim revenue at scale — all in real time.
          </p>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-screen-2xl px-5 py-8 space-y-6">

        {/* KPI Metrics */}
        <MetricsHeader onRefresh={handleRefresh} lastRefreshed={lastRefreshed} />

        {/* Divider */}
        <div className="h-px bg-slate-800" />

        {/* ── Batch Simulation Engine ─────────────────────────────────── */}
        <BatchSimulator onBatchComplete={handleRefresh} />

        {/* Divider */}
        <div className="h-px bg-slate-800" />

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CategoryFilter
            selected={selectedCategory}
            onChange={setSelectedCategory}
            counts={counts}
          />
        </div>

        {/* Events Table */}
        <EventTable
          category={selectedCategory}
          onInspect={handleInspect}
          onCountsChange={handleCounts}
          lastRefreshed={lastRefreshed}
          onRecoverSuccess={handleRefresh}
        />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 px-5 py-5 text-center text-xs text-slate-700">
        <p>
          RazorShield AI — Built for{' '}
          <span className="text-blue-500 font-semibold">Razorpay Buildathon 2026</span>
          {' '}· Track 03: AI-Powered Revenue Recovery Engine
        </p>
      </footer>

      {/* ── Audit Log Drawer (Portal) ─────────────────────────────────── */}
      <AuditLogDrawer eventId={inspectId} onClose={handleClose} />
    </div>
  );
}
