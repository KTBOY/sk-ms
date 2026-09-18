import { Children, forwardRef, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ChangeEvent, InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from 'react';
import { IconAlert, IconCheck } from '../icons';

/** 自研基础组件库：Resonance HUD 设计系统（近黑底 / 金发丝边 / 纯直角）。 */

export function Button({
  variant = 'glass', size = 'md', icon, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'glass' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}) {
  const cls = ['ui-btn', `ui-btn--${variant}`, size === 'sm' ? 'ui-btn--sm' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon}
      {children != null && children !== '' && <span>{children}</span>}
    </button>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`} {...rest} />;
}

/** HUD 风格勾选框：金色对角勾，纯直角。 */
export function Checkbox({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={`ui-checkbox ${className}`} {...rest} />;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`ui-input ui-textarea ${className}`} {...rest} />;
  },
);

interface SelectOptionProps {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * HUD 下拉框：自绘弹层（原生 select 的弹出列表由操作系统渲染，无法主题化）。
 * 兼容原生 select 的事件契约：沿用 <option> 子元素声明选项，
 * onChange 仍收到 { target: { value } } 形状的事件，调用点零改动。
 */
export function Select({ className = '', children, value, onChange, disabled, placeholder }: {
  className?: string;
  children?: ReactNode;
  value?: string | number;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => (
    Children.toArray(children)
      .filter((o): o is ReactElement<SelectOptionProps> => isValidElement(o))
      .map((o, i) => ({
        value: o.props.value != null ? String(o.props.value) : String(i),
        label: String(o.props.children ?? ''),
        disabled: Boolean(o.props.disabled),
      }))
  ), [children]);

  const valueStr = String(value ?? '');
  const current = options.find((o) => o.value === valueStr);

  const commit = (v: string) => {
    setOpen(false);
    if (v === valueStr) return;
    onChange?.({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  const openPop = () => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === valueStr);
    setHi(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`ui-select-root ${className}`} ref={rootRef}>
      <button
        type="button"
        className="ui-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPop())}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openPop(); }
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            setHi((h) => {
              let n = h;
              for (let i = 0; i < options.length; i++) {
                n = (n + dir + options.length) % options.length;
                if (!options[n].disabled) break;
              }
              return n;
            });
          } else if (e.key === 'Enter' && options[hi] && !options[hi].disabled) {
            e.preventDefault();
            commit(options[hi].value);
          }
        }}
      >
        <span className={current ? '' : 'ui-select__placeholder'}>{current ? current.label : placeholder ?? '请选择'}</span>
        <svg className="ui-select__chev" width="10" height="6" viewBox="0 0 10 6" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul className="ui-select__pop" role="listbox">
          {options.map((o, i) => (
            <li key={`${o.value}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === valueStr}
                disabled={o.disabled}
                className={`ui-select__opt${o.value === valueStr ? ' is-active' : ''}${i === hi ? ' is-hi' : ''}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => commit(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {hint && !error && <span className="ui-field__hint">{hint}</span>}
      {error && (
        <span className="ui-field__error"><IconAlert size={13} /> {error}</span>
      )}
    </label>
  );
}

export function Tag({ color, children, onClick, title }: {
  color?: string; children: ReactNode; onClick?: () => void; title?: string;
}) {
  return (
    <span className="ui-tag" style={color ? ({ '--tag-c': color } as React.CSSProperties) : undefined}
      onClick={onClick} title={title}>
      {children}
    </span>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
          <rect x="8" y="12" width="36" height="30" rx="4" stroke="currentColor" strokeWidth="2" opacity=".5" />
          <path d="M8 20h36" stroke="currentColor" strokeWidth="2" opacity=".35" />
          <circle cx="20" cy="29" r="4" stroke="currentColor" strokeWidth="2" opacity=".6" />
          <path d="M15 38c1.4-3 3.2-4.5 5-4.5s3.6 1.5 5 4.5" stroke="currentColor" strokeWidth="2" opacity=".6" />
          <rect x="30" y="27" width="9" height="2" rx="1" fill="currentColor" opacity=".5" />
          <rect x="30" y="32" width="6" height="2" rx="1" fill="currentColor" opacity=".35" />
        </svg>
      </div>
      <div className="ui-empty__title">{title}</div>
      {hint && <div className="ui-empty__hint">{hint}</div>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ui-segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={`ui-segmented__item ${o.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ state }: { state: 'saving' | 'saved' | 'idle' | 'error' }) {
  if (state === 'idle') return null;
  return (
    <span className={`ui-status ui-status--${state}`}>
      {state === 'error' ? <><IconAlert size={12} /> 保存失败</> : state === 'saving' ? '保存中…' : <><IconCheck size={12} /> 已自动保存</>}
    </span>
  );
}

/** 简易星级（重要度）。只读时渲染 span，避免嵌套在按钮内时出现 button-in-button。 */
export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="ui-stars">
      {[1, 2, 3, 4, 5].map((n) => {
        const cls = `ui-stars__star ${n <= value ? 'is-on' : ''}`;
        return onChange ? (
          <button key={n} type="button" className={cls} onClick={() => onChange(n)}>★</button>
        ) : (
          <span key={n} className={cls}>★</span>
        );
      })}
    </span>
  );
}
