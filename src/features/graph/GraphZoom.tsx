/** 图谱缩放控制组：放大 / 缩小 / 复位视图（HUD 方格按钮）。 */
export function GraphZoomControls({ onIn, onOut, onReset }: {
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="graph-zoom" role="group" aria-label="视图缩放">
      <button type="button" title="放大" aria-label="放大" onClick={onIn}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
          <path d="M6 1.5v9M1.5 6h9" />
        </svg>
      </button>
      <button type="button" title="缩小" aria-label="缩小" onClick={onOut}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
          <path d="M1.5 6h9" />
        </svg>
      </button>
      <button type="button" title="复位视图" aria-label="复位视图" onClick={onReset}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
          <path d="M1 4V1h3M11 4V1H8M1 8v3h3M11 8v3H8" />
        </svg>
      </button>
    </div>
  );
}
