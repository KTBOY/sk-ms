import type { Character } from '../../core/types';

/** 人物形象：有图显示图片；无图显示"白底剪影"占位（设计规范 5.1）。 */

export function CharacterAvatar({ character, size = 56, editable, onPick, onFile }: {
  character: Pick<Character, 'name' | 'avatar'>;
  size?: number;
  editable?: boolean;
  onPick?: (dataUrl: string) => void;
  /** 提供时选中文件后交给外部处理（如先裁剪），否则直接压缩为方形图 */
  onFile?: (file: File) => void;
}) {
  const radius = Math.max(10, Math.round(size * 0.28));

  const pick = () => {
    if (!editable || !onPick) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (onFile) { onFile(file); return; }
      const dataUrl = await compressImage(file, 256);
      onPick(dataUrl);
    };
    input.click();
  };

  if (character.avatar) {
    return (
      <span className={`avatar avatar--img ${editable ? 'avatar--editable' : ''}`}
        style={{ width: size, height: size, borderRadius: radius }} onClick={pick}
        title={editable ? '点击更换形象' : undefined}>
        <img src={character.avatar} alt={character.name} draggable={false} />
      </span>
    );
  }
  return (
    <span className={`avatar avatar--placeholder ${editable ? 'avatar--editable' : ''}`}
      style={{ width: size, height: size, borderRadius: radius }} onClick={pick}
      title={editable ? '点击上传形象' : character.name}>
      <PlaceholderSvg size={size} />
      {size >= 96 && <span className="avatar__hint">暂无形象</span>}
    </span>
  );
}

function PlaceholderSvg({ size }: { size: number }) {
  return (
    <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.2" r="4.2" fill="#c9ac67" opacity=".32" />
      <path d="M2.8 21c.9-4.6 4.4-7 9.2-7s8.3 2.4 9.2 7" fill="#c9ac67" opacity=".32" />
    </svg>
  );
}

/** 图片压缩为方形 dataURL（最长边 maxPx），控制存储体积。 */
export function compressImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('画布不可用')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
