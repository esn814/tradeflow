import { memo } from 'react';
import { ChevronRight } from 'lucide-react';

/* ── Reusable UI primitives for consistent, professional pages ── */

export const Card = memo(function Card({ children, className = '', hover = false, accent = false, ...props }) {
  const base = accent
    ? 'bg-[var(--color-surface-1)] border border-[var(--color-accent)]/20 rounded-2xl'
    : 'bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-2xl';
  const effect = hover ? 'hover:border-[var(--color-border-card-hover)] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200' : '';
  return <div className={`${base} ${effect} ${className}`} {...props}>{children}</div>;
});

export const CardBody = memo(function CardBody({ children, className = '' }) {
  return <div className={`p-5 sm:p-6 ${className}`}>{children}</div>;
});

export const SectionHeader = memo(function SectionHeader({ icon: Icon, title, badge, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={16} className="text-[var(--color-accent)]" />}
        <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h2>
        {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-accent-14)] text-[var(--color-accent)]">{badge}</span>}
      </div>
      {action}
    </div>
  );
});

export function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] text-white font-bold shadow-md shadow-[var(--color-accent-20)] hover:shadow-lg hover:shadow-[var(--color-accent-35)] hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-semibold border border-[var(--color-border-strong)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] font-medium hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]',
    danger: 'bg-[var(--color-danger-15)] text-[var(--color-danger)] font-semibold border border-[var(--color-danger-30)] hover:bg-[var(--color-danger-25)]',
    success: 'bg-[var(--color-success-15)] text-[var(--color-success)] font-semibold border border-[var(--color-success-30)] hover:bg-[var(--color-success-25)]',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl',
    full: 'w-full py-4 text-lg rounded-xl justify-center',
  };
  return (
    <button className={`inline-flex items-center gap-2 transition-all duration-200 cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkCard({ icon: Icon, title, desc, color = 'var(--color-accent)', onClick, badge }) {
  return (
    <Card hover onClick={onClick} className="p-5 cursor-pointer text-left group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: color + '18', color }}>
          <Icon size={20} />
        </div>
        {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: color + '18', color }}>{badge}</span>}
      </div>
      <h3 className="text-[var(--color-text-primary)] font-bold text-sm mb-1">{title}</h3>
      <p className="text-[var(--color-text-muted)] text-xs leading-relaxed">{desc}</p>
      <div className="flex items-center text-[var(--color-accent)] text-xs font-semibold mt-3 group-hover:gap-2 gap-1 transition-all">
        Open <ChevronRight size={12} />
      </div>
    </Card>
  );
}

export function Stat({ label, value, color = 'text-[var(--color-text-primary)]', sub }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-[var(--color-text-muted)] mb-1 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-extrabold ${color} tracking-tight`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{sub}</div>}
    </Card>
  );
}

export function Input({ label, hint, type = 'text', className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">{label}</label>}
      <input
        type={type}
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors"
        {...props}
      />
      {hint && <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, desc, checked, onChange, color = 'var(--color-accent)' }) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-[var(--color-surface-2)] rounded-xl">
      <div>
        <span className="text-sm text-[var(--color-text-primary)] font-medium">{label}</span>
        {desc && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{desc}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? '' : 'bg-[var(--color-border-strong)]'}`}
        style={checked ? { background: color } : {}}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function Badge({ children, variant = 'accent' }) {
  const variants = {
    accent: 'bg-[var(--color-accent-14)] text-[var(--color-accent)]',
    success: 'bg-[var(--color-success-18)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-alt-18)] text-[var(--color-warning-alt)]',
    danger: 'bg-[var(--color-danger-18)] text-[var(--color-danger)]',
    info: 'bg-[var(--color-info-18)] text-[var(--color-info)]',
    purple: 'bg-[var(--color-purple-18)] text-[var(--color-purple)]',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, badge, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon size={20} className="text-[var(--color-accent)]" />}
          <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight">{title}</h1>
          {badge && <Badge>{badge}</Badge>}
        </div>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-border-strong)] to-transparent my-4" />;
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <Card className="p-8 text-center">
      {Icon && <Icon size={32} className="text-[var(--color-text-muted)] mx-auto mb-3" />}
      <h3 className="text-[var(--color-text-primary)] font-bold mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{desc}</p>
      {action}
    </Card>
  );
}
