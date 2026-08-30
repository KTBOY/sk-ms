import { useState } from 'react';
import { createAdapter, type AdapterId } from '../../core/storage';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Button, Field, Input, Segmented, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { IconPlus, IconRefresh, IconTrash } from '../../components/icons';

/** 设置：存储适配器（含 REST 契约）/ AI 接口 / 作品管理 / 危险区。 */

export function SettingsPage() {
  const project = useProjectStore((s) => s.project);
  const projects = useProjectStore((s) => s.projects);
  const appSettings = useProjectStore((s) => s.appSettings);
  const setAdapter = useProjectStore((s) => s.setAdapter);
  const switchProject = useProjectStore((s) => s.switchProject);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const resetToSeed = useProjectStore((s) => s.resetToSeed);
  const clearProject = useProjectStore((s) => s.clearProject);
  const update = useProjectStore((s) => s.update);
  const confirm = useUIStore((s) => s.confirm);
  const pushToast = useUIStore((s) => s.pushToast);

  const [restBase, setRestBase] = useState(appSettings.rest.baseUrl);
  const [restToken, setRestToken] = useState(appSettings.rest.token);
  const [testing, setTesting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', genre: '', description: '' });

  if (!project) return null;

  const testConnection = async () => {
    setTesting(true);
    try {
      const adapter = createAdapter({ ...appSettings, adapterId: 'rest', rest: { baseUrl: restBase, token: restToken } });
      await adapter.listProjects();
      pushToast('连接成功，接口契约匹配', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '连接失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  const switchAdapter = async (id: AdapterId) => {
    if (id === appSettings.adapterId) return;
    const ok = await confirm('切换存储适配器', '建议先在「导出」页备份 JSON。切换后作品列表将读取新数据源，未导出的修改不会迁移。');
    if (!ok) return;
    await setAdapter(id, id === 'rest' ? { baseUrl: restBase, token: restToken } : undefined);
    pushToast(`已切换到${id === 'rest' ? ' REST API' : id === 'localstorage' ? ' LocalStorage' : ' IndexedDB'}`, 'success');
  };

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h2>设置<span className="page__en">RESONANCE TERMINAL</span></h2>
          <p className="page__sub">数据存储、AI 接口与作品管理</p>
        </div>
      </header>

      {/* 存储适配器 */}
      <section className="glass-panel">
        <header className="glass-panel__head"><h3>存储适配器</h3></header>
        <div style={{ padding: 16 }}>
          <Segmented<AdapterId>
            value={appSettings.adapterId}
            onChange={(v) => void switchAdapter(v)}
            options={[
              { value: 'indexeddb', label: 'IndexedDB（本地·推荐）' },
              { value: 'localstorage', label: 'LocalStorage' },
              { value: 'rest', label: 'REST API（远程）' },
            ]} />
          <p className="dim" style={{ marginTop: 12 }}>
            数据默认只存在你的浏览器里。预置 REST 适配器 —— 服务端实现以下契约即可无缝上云：
            <code className="contract">GET /projects · GET /projects/:id · PUT /projects/:id · DELETE /projects/:id</code>
            （鉴权可选 Authorization: Bearer，需开启 CORS）
          </p>
          {appSettings.adapterId === 'rest' && (
            <div className="grid2" style={{ marginTop: 12 }}>
              <Field label="Base URL"><Input value={restBase} onChange={(e) => setRestBase(e.target.value)} placeholder="https://api.example.com/novel" /></Field>
              <Field label="Token（可选）"><Input value={restToken} onChange={(e) => setRestToken(e.target.value)} placeholder="Bearer 鉴权令牌" /></Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => void testConnection()} disabled={testing || !restBase}>{testing ? '测试中…' : '测试连接'}</Button>
                <Button variant="primary" disabled={!restBase}
                  onClick={async () => {
                    await setAdapter('rest', { baseUrl: restBase, token: restToken });
                    pushToast('REST 配置已保存并生效', 'success');
                  }}>保存并启用</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* AI 接口 */}
      <section className="glass-panel">
        <header className="glass-panel__head"><h3>AI 接口（OpenAI 兼容，预留）</h3></header>
        <div style={{ padding: 16 }}>
          <p className="dim" style={{ marginBottom: 12 }}>
            配置后写作台可一键「发送给 AI」—— 发送内容为自动组装的上下文包，设定不漂移。
          </p>
          <div className="grid2">
            <Field label="Base URL">
              <Input value={project.settings.ai.baseUrl} placeholder="https://api.openai.com/v1"
                onChange={(e) => update((p) => { p.settings.ai.baseUrl = e.target.value; })} />
            </Field>
            <Field label="模型名">
              <Input value={project.settings.ai.model} placeholder="如 gpt-4o-mini / deepseek-chat"
                onChange={(e) => update((p) => { p.settings.ai.model = e.target.value; })} />
            </Field>
            <Field label="API Key" hint="仅保存在本地存储，不会上传">
              <Input type="password" value={project.settings.ai.apiKey}
                onChange={(e) => update((p) => { p.settings.ai.apiKey = e.target.value; })} />
            </Field>
          </div>
        </div>
      </section>

      {/* 作品管理 */}
      <section className="glass-panel">
        <header className="glass-panel__head">
          <h3>作品管理</h3>
          <Button size="sm" icon={<IconPlus size={13} />} onClick={() => { setForm({ name: '', genre: '', description: '' }); setNewOpen(true); }}>新建作品</Button>
        </header>
        <ul className="proj-list">
          {projects.map((p) => (
            <li key={p.id} className={p.id === project.id ? 'is-active' : ''}>
              <div>
                <b>{p.name}</b>
                <span className="dim">{p.genre || '未设题材'} · {new Date(p.updatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className="proj-list__ops">
                {p.id !== project.id && <Button size="sm" onClick={() => void switchProject(p.id)}>切换</Button>}
                {p.id === project.id && <Button size="sm" onClick={() => { setForm({ name: project.name, genre: project.genre, description: project.description }); setEditOpen(true); }}>编辑信息</Button>}
                <Button size="sm" variant="danger" icon={<IconTrash size={12} />}
                  onClick={async () => {
                    const ok = await confirm('删除作品', `确定删除「${p.name}」？此操作不可恢复，建议先导出 JSON 备份。`);
                    if (ok) { await deleteProject(p.id); pushToast('作品已删除', 'warning'); }
                  }}>删除</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 危险区 */}
      <section className="glass-panel danger-zone">
        <header className="glass-panel__head"><h3>危险区</h3></header>
        <div className="danger-zone__ops" style={{ padding: 16 }}>
          <Button icon={<IconRefresh size={14} />} onClick={async () => {
            const ok = await confirm('恢复示例数据', `将把「${project.name}」重置为示例作品《九州烟云》的内容，当前数据会丢失。`, false);
            if (ok) { await resetToSeed(); pushToast('已恢复示例数据', 'success'); }
          }}>恢复示例数据</Button>
          <Button variant="danger" icon={<IconTrash size={14} />} onClick={async () => {
            const ok = await confirm('清空当前作品', `确定清空「${project.name}」的全部人物/事件/章节？`);
            if (ok) { clearProject(); pushToast('作品已清空', 'warning'); }
          }}>清空当前作品</Button>
        </div>
      </section>

      {/* 新建/编辑作品弹窗 */}
      <Modal open={newOpen || editOpen} width={480}
        title={newOpen ? '新建作品' : '编辑作品信息'}
        onClose={() => { setNewOpen(false); setEditOpen(false); }}
        footer={<>
          <Button onClick={() => { setNewOpen(false); setEditOpen(false); }}>取消</Button>
          <Button variant="primary" onClick={async () => {
            if (!form.name.trim()) { pushToast('作品名不能为空', 'error'); return; }
            if (newOpen) { await createProject(form.name.trim(), form.genre.trim(), form.description.trim()); pushToast(`作品「${form.name}」已创建`, 'success'); }
            else { renameProject(form.name.trim(), form.genre.trim(), form.description.trim()); pushToast('作品信息已更新', 'success'); }
            setNewOpen(false); setEditOpen(false);
          }}>{newOpen ? '创建' : '保存'}</Button>
        </>}>
        <Field label="作品名 *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：九州烟云" /></Field>
        <Field label="题材"><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="如：东方玄幻" /></Field>
        <Field label="一句话简介" hint="会进入上下文包">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
