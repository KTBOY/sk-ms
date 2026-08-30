import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './primitives';

/** 头像裁剪弹窗：方形舞台 + 圆形取景框，支持拖拽平移与缩放，输出方形 dataURL。 */

const OUT_PX = 256; // 输出尺寸，与 compressImage 保持一致
const STAGE_PX = 320; // 取景舞台边长（弹窗固定宽度内）

export function ImageCropModal({ open, file, title = '裁剪头像', onClose, onConfirm }: {
  open: boolean;
  file: File | null;
  title?: string;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = 图片短边恰好覆盖取景框
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open || !file) { setSrc(null); setNatural(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // 图片短边恰好覆盖舞台的缩放
  const baseScale = natural ? STAGE_PX / Math.min(natural.w, natural.h) : 1;

  // 将平移限制在图片完全覆盖舞台的范围内
  const clampOffset = (z: number, next: { x: number; y: number }) => {
    if (!natural) return next;
    const scale = baseScale * z;
    const maxX = Math.max(0, (natural.w * scale - STAGE_PX) / 2);
    const maxY = Math.max(0, (natural.h * scale - STAGE_PX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const updateZoom = (z: number) => {
    const clamped = Math.min(5, Math.max(1, z));
    setZoom(clamped);
    setOffset((o) => clampOffset(clamped, o));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clampOffset(zoom, { x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }));
  };
  const onPointerUp = () => { dragRef.current = null; setDragging(false); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    updateZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  };

  const confirm = () => {
    if (!src || !natural) return;
    const scale = baseScale * zoom;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_PX;
    canvas.height = OUT_PX;
    const ctx = canvas.getContext('2d');
    const el = imgRef.current;
    if (!ctx || !el) return;
    // 舞台中心（即取景框中心）对应到图片上的采样区域
    const cx = natural.w / 2 - offset.x / scale;
    const cy = natural.h / 2 - offset.y / scale;
    const half = STAGE_PX / 2 / scale;
    ctx.drawImage(el, cx - half, cy - half, half * 2, half * 2, 0, 0, OUT_PX, OUT_PX);
    onConfirm(canvas.toDataURL('image/jpeg', 0.82));
    onClose();
  };

  return (
    <Modal open={open && !!file} title={title} width={STAGE_PX + 100} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={confirm} disabled={!natural}>确认裁剪</Button>
      </>}>
      <div className={`imgcrop ${dragging ? 'imgcrop--dragging' : ''}`}>
        <div className="imgcrop__stage" style={{ width: STAGE_PX, height: STAGE_PX }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
          {src && (
            <img className="imgcrop__img" src={src} alt="" draggable={false}
              ref={imgRef}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              style={{
                width: natural ? natural.w * baseScale * zoom : 'auto',
                height: natural ? natural.h * baseScale * zoom : 'auto',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }} />
          )}
          <div className="imgcrop__mask" />
        </div>
        <div className="imgcrop__zoom">
          <span>缩小</span>
          <input type="range" min={1} max={5} step={0.01} value={zoom}
            onChange={(e) => updateZoom(Number(e.target.value))} />
          <span>放大</span>
        </div>
        <p className="imgcrop__hint">拖动图片调整位置，滚轮或滑杆调整缩放</p>
      </div>
    </Modal>
  );
}
