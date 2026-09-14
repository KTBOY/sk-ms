import { create } from 'zustand';
import type { EntityKind } from '../core/types';

/** UI 状态：页面路由（hash 同步）、Toast、确认弹窗、实体详情跳转。 */

export type Page =
  | 'dashboard' | 'writing' | 'characters' | 'graph' | 'events' | 'timeline'
  | 'locations' | 'factions' | 'items' | 'atlas' | 'export' | 'settings';

export const PAGE_TITLES: Record<Page, string> = {
  dashboard: '总览',
  writing: '写作台',
  characters: '人物',
  graph: '图谱',
  events: '事件',
  timeline: '时间线',
  locations: '地点',
  factions: '势力',
  items: '物品',
  atlas: '设定集',
  export: '导出',
  settings: '设置',
};

export const KIND_PAGE: Record<EntityKind, Page> = {
  character: 'characters',
  event: 'events',
  item: 'items',
  location: 'locations',
  faction: 'factions',
};

export interface Toast {
  id: number;
  kind: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

interface ConfirmRequest {
  title: string;
  message: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIStore {
  page: Page;
  focus: { kind: EntityKind; id: string } | null; // 跨页跳转到某实体详情
  toasts: Toast[];
  confirmReq: ConfirmRequest | null;

  navigate: (page: Page) => void;
  syncFromHash: () => void;
  openDetail: (kind: EntityKind, id: string) => void;
  consumeFocus: () => void;
  pushToast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  confirm: (title: string, message: string, danger?: boolean) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

let toastSeq = 1;

function pageFromHash(): Page | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const page = hash.split('?')[0] as Page;
  return page in PAGE_TITLES ? page : null;
}

export const useUIStore = create<UIStore>()((set, get) => ({
  page: pageFromHash() ?? 'dashboard',
  focus: null,
  toasts: [],
  confirmReq: null,

  navigate: (page) => {
    window.location.hash = `#/${page}`;
    set({ page, focus: null });
  },

  syncFromHash: () => {
    const page = pageFromHash();
    if (page && page !== get().page) set({ page, focus: null });
  },

  openDetail: (kind, id) => {
    const page = KIND_PAGE[kind];
    window.location.hash = `#/${page}`;
    set({ page, focus: { kind, id } });
  },

  consumeFocus: () => set({ focus: null }),

  pushToast: (text, kind = 'info') => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), 3600);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  confirm: (title, message, danger = true) =>
    new Promise<boolean>((resolve) => {
      set({ confirmReq: { title, message, danger, resolve } });
    }),

  resolveConfirm: (ok) => {
    const req = get().confirmReq;
    req?.resolve(ok);
    set({ confirmReq: null });
  },
}));
