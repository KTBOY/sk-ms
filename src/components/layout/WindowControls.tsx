import { useEffect, useState } from 'react';
import type { DesktopBridge } from '../../core/desktop';

/**
 * 无边框窗口控制组：最小化 / 最大化-还原 / 关闭，融入顶栏右上角。
 * 内联 SVG 描边图标（stroke 2.2），关闭态 hover 红 —— 与原生标题栏心智一致（同 flash-edit）。
 * 仅桌面端渲染（无 moshuDesktop 桥的浏览器环境不挂载）。
 */
function MinGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function MaxGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter">
      <rect x="5" y="5" width="14" height="14" />
    </svg>
  );
}

function RestoreGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M8.5 8.5V5H19v10.5h-3.5" />
      <rect x="5" y="8.5" width="10.5" height="10.5" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function WindowControls({ bridge }: { bridge: DesktopBridge }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    bridge.isMaximized().then(setMaximized).catch(() => undefined);
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = bridge.onMaximizedChange(setMaximized);
    } catch {
      // 桥未就绪时忽略，保持默认图标
    }
    return () => unsubscribe?.();
  }, [bridge]);

  return (
    <div className="win-controls">
      <button type="button" aria-label="最小化" title="最小化" onClick={() => bridge.minimize()}>
        <MinGlyph />
      </button>
      <button
        type="button"
        aria-label={maximized ? '还原' : '最大化'}
        title={maximized ? '向下还原' : '最大化'}
        onClick={() => bridge.toggleMaximize()}
      >
        {maximized ? <RestoreGlyph /> : <MaxGlyph />}
      </button>
      <button type="button" className="close" aria-label="关闭" title="关闭" onClick={() => bridge.close()}>
        <CloseGlyph />
      </button>
    </div>
  );
}
