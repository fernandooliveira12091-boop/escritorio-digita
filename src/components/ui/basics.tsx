import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { initials } from "../../lib/format";
import type { User } from "../../types";

export function Avatar({ user, size = 28, online }: { user?: Pick<User, "name" | "color">; size?: number; online?: boolean }) {
  if (!user) return null;
  return (
    <span className="relative inline-flex shrink-0" title={user.name}>
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-[#12151B]"
        style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
        aria-hidden="true"
      >
        {initials(user.name)}
      </span>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#12151B] ${online ? "bg-green-500" : "bg-gray-300"}`} aria-label={online ? "Online" : "Offline"} />
      )}
    </span>
  );
}

export function AvatarStack({ users, size = 24 }: { users: User[]; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {users.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className = "" }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b border-line dark:border-white/10 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${value === t.id ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-white"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-white p-0.5 dark:border-white/10 dark:bg-[#0F1115]">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === o.id ? "bg-primary text-white" : "text-ink-muted hover:text-ink dark:text-gray-400"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? "bg-primary" : "bg-gray-300 dark:bg-white/20"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = true, actions }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="flex items-center gap-2 text-base font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>
          {title}
          <ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
        {actions}
      </div>
      {open && children}
    </section>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-ink-muted dark:text-gray-400">
      {children}
      {action}
    </div>
  );
}

export function Dropdown({ trigger, children, align = "right", label }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        {trigger(open)}
      </div>
      {open && (
        <div role="menu" className={`absolute z-40 mt-2 min-w-[200px] rounded-xl border border-line bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#171A21] ${align === "right" ? "right-0" : "left-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/10 ${danger ? "text-red-600" : ""}`}>
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={`surface my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"} shadow-xl`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-white/10">
          <h2 className="h2">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl dark:bg-[#12151B]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-white/10">
          <h2 className="h2">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3 dark:border-white/10">{footer}</div>}
      </aside>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
