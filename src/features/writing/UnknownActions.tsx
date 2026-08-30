import type { UnknownCandidate } from '../../core/consistency';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Tag } from '../../components/ui/primitives';
import { IconAlert, IconX } from '../../components/icons';

/**
 * 未登记名词提示卡（一致性引擎第一层的操作面板）。
 * 写作台右栏与预览气泡共用同一套动作：设为人物 / 登记为别名 / 忽略。
 */
export function UnknownActions({ candidate, onCreate, compact }: {
  candidate: UnknownCandidate;
  onCreate?: (word: string) => void;
  compact?: boolean;
}) {
  const addAliasTo = useProjectStore((s) => s.addAliasTo);
  const addIgnoreWord = useProjectStore((s) => s.addIgnoreWord);
  const pushToast = useUIStore((s) => s.pushToast);
  const best = candidate.suggestions[0];

  return (
    <div className={`unknown-card ${compact ? 'unknown-card--compact' : ''}`}>
      <div className="unknown-card__head">
        <IconAlert size={14} />
        <span>图谱中未找到「<b>{candidate.word}</b>」</span>
        <span className="unknown-card__count">出现 {candidate.count} 次</span>
      </div>
      {best && (
        <div className="unknown-card__suggest">
          你可能想写：<Tag color="#C9A6FF">{best.name}</Tag>
          <span className="dim">相似度 {Math.round(best.score * 100)}%</span>
          <button type="button" className="unknown-card__link"
            onClick={() => { addAliasTo('character', best.entityId, candidate.word); pushToast(`「${candidate.word}」已登记为「${best.name}」的别名`, 'success'); }}>
            登记为TA的别名
          </button>
        </div>
      )}
      <div className="unknown-card__ops">
        <Button size="sm" variant="primary" onClick={() => onCreate?.(candidate.word)}>设为人物</Button>
        {!best && <span className="unknown-card__hint">或去设计器登记为其他实体</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="unknown-card__link"
          onClick={() => { addIgnoreWord(candidate.word); pushToast(`已忽略「${candidate.word}」`, 'info'); }}>
          加入忽略词表
        </button>
      </div>
    </div>
  );
}

/** 预览模式的未登记名词点击气泡。 */
export function UnknownBubble({ candidate, position, onCreate, onClose }: {
  candidate: UnknownCandidate;
  position: { x: number; y: number };
  onCreate: (word: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="unknown-bubble" style={{ left: position.x, top: position.y }}>
      <button type="button" className="unknown-bubble__close" onClick={onClose} aria-label="关闭"><IconX size={13} /></button>
      <UnknownActions candidate={candidate} onCreate={onCreate} compact />
    </div>
  );
}
