import { useEffect, useState } from 'react';
import { RELATION_TYPES } from '../../core/types';
import type { Character, CharacterAttributes, CharacterRole } from '../../core/types';

type AttributeKey = keyof CharacterAttributes;
import { newId } from '../../core/id';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../../components/ui/Modal';
import { Button, Field, Input, Select, Textarea } from '../../components/ui/primitives';
import { EntityPickerSingle } from '../../components/ui/EntityPicker';
import { CharacterAvatar, compressImage } from '../../components/ui/Avatar';
import { ImageCropModal } from '../../components/ui/ImageCropModal';
import { generateAvatar } from '../../core/genAvatar';
import { IconUpload, IconX } from '../../components/icons';

const ROLES: CharacterRole[] = ['主角', '配角', '反派', '路人'];
const STATUSES = ['在世', '死亡', '未知'] as const;
const ATTR_DIMS: Array<{ key: AttributeKey; label: string }> = [
  { key: 'power', label: '力量' }, { key: 'wisdom', label: '智谋' }, { key: 'charm', label: '魅力' },
  { key: 'will', label: '意志' }, { key: 'fortune', label: '机缘' },
];

export function emptyCharacter(name = ''): Character {
  const now = Date.now();
  return {
    id: newId(), name, aliases: [], description: '', tags: [],
    role: '配角', gender: '', age: '', factionId: null, status: '在世',
    appearance: '', personality: '', background: '', goals: '', avatar: null,
    attributes: { power: 50, wisdom: 50, charm: 50, will: 50, fortune: 50 },
    createdAt: now, updatedAt: now,
  };
}

export function CharacterFormModal({ open, initial, onClose }: {
  open: boolean;
  initial: Character | null; // null = 新建
  onClose: () => void;
}) {
  const upsert = useProjectStore((s) => s.upsertCharacter);
  const project = useProjectStore((s) => s.project);
  const pushToast = useUIStore((s) => s.pushToast);
  const [draft, setDraft] = useState<Character>(initial ?? emptyCharacter());
  const [aliasText, setAliasText] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [fullDataUrl, setFullDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial ? structuredClone(initial) : emptyCharacter());
      setAliasText('');
    }
  }, [open, initial]);

  if (!open || !project) return null;

  const patch = (p: Partial<Character>) => setDraft((d) => ({ ...d, ...p }));
  const nameError = draft.name.trim() ? undefined : '人物必须有名字';

  const save = () => {
    if (nameError) return;
    const cleaned: Character = { ...draft, name: draft.name.trim() };
    upsert(cleaned);
    pushToast(`人物「${cleaned.name}」已保存`, 'success');
    onClose();
  };

  const upload = (file: File) => {
    setCropFile(file); // 打开裁剪弹窗，裁剪确认后写入 avatar
    compressImage(file, 512).then(setFullDataUrl).catch(() => setFullDataUrl(null)); // 保存裁剪前原图
  };

  const addAliases = () => {
    const parts = aliasText.split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    patch({ aliases: [...new Set([...draft.aliases, ...parts])] });
    setAliasText('');
  };

  return (
    <Modal open={open} width={720} title={initial ? `编辑人物 · ${initial.name}` : '新建人物'}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={save} disabled={!!nameError}>保存人物</Button>
      </>}>
      <div className="charform">
        <div className="charform__side">
          <CharacterAvatar character={draft} size={132} editable
            onPick={(d) => patch({ avatar: d })}
            onFile={upload} />
          {draft.avatar && (
            <Button size="sm" variant="ghost" icon={<IconX size={13} />} onClick={() => patch({ avatar: null, avatarFull: null })}>移除形象</Button>
          )}
          <Button size="sm" icon={<IconUpload size={13} />} onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => { const f = input.files?.[0]; if (f) upload(f); };
            input.click();
          }}>{draft.avatar ? '更换形象' : '上传形象'}</Button>
          <Button size="sm" variant="ghost" onClick={() => patch({ avatar: generateAvatar(`${draft.name}-${Date.now()}`, draft.gender) })}>
            {draft.avatar ? '随机换一个' : '随机生成'}
          </Button>
        </div>
        <div className="charform__main">
          <div className="grid2">
            <Field label="姓名 *" error={nameError}>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="如：林霄" />
            </Field>
            <Field label="别名 / 称号" hint="逗号分隔；别名也会参与正文识别">
              <div className="alias-row">
                <Input value={aliasText} onChange={(e) => setAliasText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAliases(); } }}
                  placeholder="如：霄少、小霄" />
                <Button size="sm" onClick={addAliases}>添加</Button>
              </div>
              {draft.aliases.length > 0 && (
                <div className="alias-chips">
                  {draft.aliases.map((a) => (
                    <span key={a} className="ui-tag">
                      {a}
                      <button type="button" onClick={() => patch({ aliases: draft.aliases.filter((x) => x !== a) })}><IconX size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
            <Field label="身份定位">
              <Select value={draft.role} onChange={(e) => patch({ role: e.target.value as CharacterRole })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="所属势力">
              <EntityPickerSingle kind="faction" value={draft.factionId} onChange={(id) => patch({ factionId: id })} placeholder="选择势力" />
            </Field>
            <Field label="性别"><Input value={draft.gender} onChange={(e) => patch({ gender: e.target.value })} placeholder="如：男" /></Field>
            <Field label="年龄"><Input value={draft.age} onChange={(e) => patch({ age: e.target.value })} placeholder="如：16" /></Field>
            <Field label="生死状态">
              <Select value={draft.status} onChange={(e) => patch({ status: e.target.value as Character['status'] })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="标签" hint="逗号分隔"><Input value={draft.tags.join('、')} onChange={(e) => patch({ tags: e.target.value.split(/[，,、]+/).map((s) => s.trim()).filter(Boolean) })} /></Field>
          </div>
          <Field label="一句话描述"><Input value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="一句话让 AI 记住TA" /></Field>
          <div className="grid2">
            <Field label="外观"><Textarea rows={2} value={draft.appearance} onChange={(e) => patch({ appearance: e.target.value })} /></Field>
            <Field label="性格"><Textarea rows={2} value={draft.personality} onChange={(e) => patch({ personality: e.target.value })} /></Field>
            <Field label="背景"><Textarea rows={2} value={draft.background} onChange={(e) => patch({ background: e.target.value })} /></Field>
            <Field label="目标动机"><Textarea rows={2} value={draft.goals} onChange={(e) => patch({ goals: e.target.value })} /></Field>
          </div>
          <Field label="五维能力（雷达图）">
            <div className="attr-sliders">
              {ATTR_DIMS.map((d) => (
                <div key={d.key} className="attr-slider">
                  <span>{d.label}</span>
                  <input type="range" min={0} max={100} value={draft.attributes[d.key]}
                    style={{ '--pct': `${draft.attributes[d.key]}%` } as React.CSSProperties}
                    onChange={(e) => patch({ attributes: { ...draft.attributes, [d.key]: Number(e.target.value) } })} />
                  <b>{draft.attributes[d.key]}</b>
                </div>
              ))}
            </div>
          </Field>
        </div>
      </div>
      <ImageCropModal open={!!cropFile} file={cropFile} title="裁剪人物形象"
        onClose={() => setCropFile(null)}
        onConfirm={(dataUrl) => patch({ avatar: dataUrl, avatarFull: fullDataUrl })} />
      <div className="sr-only">可选关系类型参考：{RELATION_TYPES.join('、')}</div>
    </Modal>
  );
}
