import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '../icons';

/** 玻璃拟态弹窗：ESC / 遮罩关闭，宽度可调。 */

export function Modal({ open, title, width = 560, onClose, children, footer }: {
  open: boolean;
  title: ReactNode;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  // Portal 到 body：.app-content 被 .app-panel > * 抬成 z-index:1 层叠上下文，会困住遮罩的 z-index:100，导致顶栏（z 5）盖在弹框上
  return createPortal(
    <div className="ui-modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ui-modal" style={{ width, maxWidth: '94vw' }} role="dialog" aria-modal>
        <div className="ui-modal__head">
          <div className="ui-modal__title">{title}</div>
          <button type="button" className="ui-iconbtn" onClick={onClose} aria-label="关闭"><IconX size={16} /></button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
