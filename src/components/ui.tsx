import React from 'react';
import { Check, X } from 'lucide-react';

/** Square checkbox that never triggers parent click / drag handlers. */
export const Checkbox: React.FC<{
  checked: boolean;
  onToggle: () => void;
  title?: string;
  size?: 'sm' | 'md';
}> = ({ checked, onToggle, title, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type="button"
      title={title ?? (checked ? 'Mark incomplete' : 'Mark complete')}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`${dim} rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
        checked
          ? 'bg-fg border-fg text-app'
          : 'border-line-strong hover:border-muted bg-transparent'
      }`}
    >
      {checked && <Check className="w-2.5 h-2.5" strokeWidth={3.5} />}
    </button>
  );
};

/** Tiny course color indicator. */
export const Dot: React.FC<{ color?: string; className?: string }> = ({
  color,
  className = '',
}) => (
  <span
    className={`w-2 h-2 rounded-full shrink-0 ${className}`}
    style={{ backgroundColor: color || 'rgb(var(--c-subtle))' }}
  />
);

/** Small icon button that stops propagation so it is safe inside draggables. */
export const ActionIcon: React.FC<{
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, danger, children }) => (
  <button
    type="button"
    title={title}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`p-1 rounded-md text-muted hover:bg-elev transition-colors ${
      danger ? 'hover:text-danger' : 'hover:text-fg'
    }`}
  >
    {children}
  </button>
);

/** Modal frame used by every create / edit dialog. */
export const ModalShell: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, width = 'max-w-lg', children }) => (
  <div
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className={`w-full ${width} panel shadow-2xl overflow-hidden`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-3.5 border-b border-line flex items-start justify-between gap-3">
        <div>
          <h3 className="section-label text-fg">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="icon-btn">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const formatHours = (minutes: number): string => {
  if (minutes === 0) return '0h';
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
};
