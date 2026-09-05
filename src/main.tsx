import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

// 桌面端（Electron preload 桥存在）标记根类名：启用顶栏拖拽区与无边框窗口控制样式；Web 端不受影响
if ('moshuDesktop' in window) {
  document.documentElement.classList.add('is-desktop');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
