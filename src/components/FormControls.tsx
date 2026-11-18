import React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export const INPUT_CLS =
  'w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488] disabled:bg-slate-50 disabled:text-slate-500';

export const SELECT_CLS =
  'w-full appearance-none pl-3.5 pr-9 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

export const COMPACT_SELECT_CLS =
  'w-full appearance-none pl-2.5 pr-8 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

export const BTN_PRIMARY_CLS =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F172A] hover:bg-slate-800 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0';

export const BTN_ACCENT_CLS =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0';

export const BTN_SECONDARY_CLS =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0';

export const BTN_DANGER_CLS =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0';

interface SelectControlProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean;
  wrapperClassName?: string;
}

export function SelectControl({
  compact = false,
  wrapperClassName = '',
  className = '',
  children,
  ...rest
}: SelectControlProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...rest}
        className={`${compact ? COMPACT_SELECT_CLS : SELECT_CLS} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none text-slate-400 absolute top-1/2 -translate-y-1/2 ${
          compact ? 'right-2 w-3.5 h-3.5' : 'right-2.5 w-4 h-4'
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  Icon?: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  Icon,
  valueClassName = 'text-slate-900',
  iconClassName = 'text-slate-500 bg-slate-100',
}: KpiCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 leading-snug">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconClassName}`}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className={`font-display text-2xl font-bold tabular-nums tracking-tight ${valueClassName}`}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}
