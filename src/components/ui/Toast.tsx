import { useUIStore } from '../../store/uiStore';
import { IconAlert, IconCheck, IconX } from '../icons';

/** Toast 通知 + 全局确认弹窗宿主（挂载于 App 根部）。 */

export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="ui-toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`ui-toast ui-toast--${t.kind}`}>
          <span className="ui-toast__icon">
            {t.kind === 'success' ? <IconCheck size={14} /> : <IconAlert size={14} />}
          </span>
          <span>{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="关闭"><IconX size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const req = useUIStore((s) => s.confirmReq);
  const resolve = useUIStore((s) => s.resolveConfirm);
  if (!req) return null;
  return (
    <div className="ui-modal-mask ui-modal-mask--confirm" onMouseDown={(e) => { if (e.target === e.currentTarget) resolve(false); }}>
      <div className="ui-modal ui-modal--confirm" style={{ width: 400 }} role="alertdialog" aria-modal>
        <div className="ui-modal__head"><div className="ui-modal__title">{req.title}</div></div>
        <div className="ui-modal__body"><p className="ui-confirm__msg">{req.message}</p></div>
        <div className="ui-modal__foot">
          <button type="button" className="ui-btn" onClick={() => resolve(false)}>取消</button>
          <button type="button" className={`ui-btn ${req.danger ? 'ui-btn--danger' : 'ui-btn--primary'}`} onClick={() => resolve(true)}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
