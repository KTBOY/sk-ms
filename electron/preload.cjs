/* preload：仅暴露白名单化的桌面桥（窗口控制 + 本机数据存储），不传递任意 channel。
   网页端（浏览器直接访问）没有此桥，渲染层据此判断桌面环境。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moshuDesktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback) => {
    ipcRenderer.send('window:maximized-changed:subscribe');
    const listener = (_event, maximized) => callback(maximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => ipcRenderer.removeListener('window:maximized-changed', listener);
  },

  /* 本机数据存储：作品 JSON 落盘到可选目录（默认软件安装目录 data/） */
  dataStorage: {
    getInfo: () => ipcRenderer.invoke('data:get-info'),
    chooseDirectory: () => ipcRenderer.invoke('data:choose-dir'),
    resetToDefault: () => ipcRenderer.invoke('data:reset-dir'),
    openFolder: () => ipcRenderer.invoke('data:open-folder'),
    listProjects: () => ipcRenderer.invoke('data:list-projects'),
    loadProject: (id) => ipcRenderer.invoke('data:load-project', id),
    saveProject: (project) => ipcRenderer.invoke('data:save-project', project),
    deleteProject: (id) => ipcRenderer.invoke('data:delete-project', id),
  },
});
