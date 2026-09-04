import React from 'react';
import { ShoppingCart, RefreshCw, Building2, LayoutGrid } from 'lucide-react';

/**
 * Filter tab definitions.
 * `value` maps to the category param sent to the API.
 * `value: ''` means "All Events" (no filter).
 */
export const FILTER_TABS = [
  {
    label: 'All Events',
    value: '',
    icon: LayoutGrid,
    description: 'Show all failure categories',
    accentColor: '#94a3b8',
  },
  {
    label: 'D2C / UPI Drops',
    value: 'D2C_CHECKOUT',
    icon: ShoppingCart,
    description: 'Checkout failures & UPI timeouts',
    accentColor: '#3b82f6',
  },
  {
    label: 'Subscriptions',
    value: 'SUBSCRIPTION_MANDATE',
    icon: RefreshCw,
    description: 'Auto-debit & mandate failures',
    accentColor: '#a855f7',
  },
  {
    label: 'B2B Invoices',
    value: 'B2B_INVOICE',
    icon: Building2,
    description: 'Overdue corporate invoices',
    accentColor: '#f59e0b',
  },
];

/**
 * CategoryFilter
 * Renders a horizontal tab bar for filtering payment events by category.
 *
 * Props:
 *   selected   {string}   — currently selected category value
 *   onChange   {function} — called with new category value on tab click
 *   counts     {object}   — { '': total, 'D2C_CHECKOUT': n, ... }
 */
export default function CategoryFilter({ selected, onChange, counts = {} }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter payment events by category">
      {FILTER_TABS.map(({ label, value, icon: Icon, description, accentColor }) => {
        const isActive = selected === value;
        const count    = counts[value] ?? null;

        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            aria-label={`${label}${count !== null ? ` — ${count} events` : ''}`}
            title={description}
            onClick={() => onChange(value)}
            className="group relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 active:scale-95"
            style={
              isActive
                ? {
                    borderColor: `${accentColor}50`,
                    background: `${accentColor}15`,
                    color: accentColor,
                    boxShadow: `0 0 12px ${accentColor}25`,
                  }
                : {
                    borderColor: 'rgba(51,65,85,0.7)',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#94a3b8',
                  }
            }
          >
            {/* Active indicator dot */}
            {isActive && (
              <span
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full animate-pulse-glow"
                style={{ background: accentColor }}
              />
            )}

            <Icon
              size={14}
              strokeWidth={isActive ? 2.5 : 2}
              style={{ color: isActive ? accentColor : '#64748b' }}
              className="transition-colors duration-200"
            />

            <span>{label}</span>

            {/* Count badge */}
            {count !== null && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={
                  isActive
                    ? { background: `${accentColor}30`, color: accentColor }
                    : { background: 'rgba(51,65,85,0.8)', color: '#64748b' }
                }
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
