; 墨枢 NovelAtlas · NSIS 自定义脚本（electron-builder 默认引用 build/installer.nsh）
; 辅助式向导默认从「安装选项」页开始，此处插入标准 MUI 欢迎页，
; 使安装流程完整：欢迎 → 安装选项 → 选择安装位置 → 安装 → 完成（运行勾选）。
; 欢迎页与完成页共用 MUI_WELCOMEFINISHPAGE_BITMAP（build/installerSidebar.bmp，由 package.json 提供）。

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
