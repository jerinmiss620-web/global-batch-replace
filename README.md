# 全局批量查找与替换 1.1.0

一个独立的 SillyTavern / TauriTavern 扩展。安装后仅从魔法棒菜单中的“全局批量查找与替换”打开，不额外占用扩展设置栏。可单独安装、更新、删除，不需要 write-work，也不加载写卡、AI 创作或前端设计工具。

1.1.0：面板底色使用 `rgb(from var(--SmartThemeBlurTintColor) r g b / 1)`，关闭背景图片和毛玻璃效果；表单控件使用酒馆及用户自定义 CSS，扩展只约束布局。作用范围和每个资源分组各有搜索框，分组搜索不会影响其他分组；筛选后的全选/清空只作用于匹配项，保留隐藏项的勾选。

手机布局支持窄屏自动换行、列表内部滚动、较大的复选标签点击区域，以及跟随 visualViewport 调整面板尺寸与位置。浏览器检查包括 320/375/390px 窄屏、横屏和模拟键盘占用后的可视区域；真实手机 TT 尚未实机验证。

## 下载与安装入口

- [ST 完整安装包](https://github.com/jerinmiss620-web/global-batch-replace/raw/refs/heads/main/downloads/global-batch-replace-1.1.0-full.zip)：含前端和 PC 服务端插件。
- [TT 前端安装包](https://github.com/jerinmiss620-web/global-batch-replace/raw/refs/heads/main/downloads/global-batch-replace-1.1.0-TT.zip)：仅前端，TT 不需要 Node 服务端插件。
- 酒馆支持从 Git 仓库安装扩展时，可填写 `https://github.com/jerinmiss620-web/global-batch-replace`。仓库根目录就是前端扩展；PC 仍须另行安装下文的配套服务端插件。

原项目与本地增补的来源记录保留在 [CREDITS.md](CREDITS.md)。

## 使用

1. 先保存酒馆其他编辑器的修改，再打开本扩展。
2. 默认是“仅查找”：填写一条或多条查找词，勾选范围，选择“全局”或勾选具体资源，然后点击“查找全部匹配”。结果显示文件、字段、命中上下文，可按规则、范围和文字筛选。仅查找任务在读写层禁止提交替换。
3. 要修改资料，切换为“查找并批量替换”，填写替换内容（留空表示删除），重新扫描替换预览。检查逐处差异，可取消整个文件或单处匹配，点击“执行替换…”后确认备份并执行。
4. 修改或恢复完成后自动重新载入酒馆，避免旧内存重新覆盖保存结果。备份入口提供逐项状态、ZIP 下载和冲突检查后的恢复。

规则是区分大小写的普通文本，不是正则表达式。按原文一次处理，不会继续替换刚生成的新内容。重叠命中优先较长匹配，同长度按规则顺序；仅查找也遵循这一规则。最多 200 条规则。常用规则可保存为命名组合；规则与选择保存在当前浏览器、当前酒馆账号的独立配置库。

筛选不会取消隐藏结果原有的勾选。首次安装不预选范围、不自动扫描、不执行修改。

## 支持的范围

| 内容 | PC SillyTavern | TauriTavern |
| --- | --- | --- |
| 用户身份名称、简介、标题与明确绑定的当前身份缓存 | 支持 | 支持 |
| 单人/群组聊天、历史分支、滑动候选和推理文本 | 支持 | 支持 |
| 角色设定、开场白、备用开场白、卡内世界书 | 支持 | 支持 |
| 独立世界书、条目正文和关键词 | 支持 | 支持 |
| 提示词条目、预设和系统提示 | 支持 | 暂未开放 |
| 全局/角色/预设中的正则规则文本 | 支持 | 暂未开放 |
| 用户 user/files 中指定的 TXT/JSON/YAML | 支持 | 暂未开放 |

“全局”指当前登录用户、当前资料集、所选范围里的全部可处理资源。不会扫描其他账号、任意硬盘目录或未知扩展数据。JSON/YAML 文本文件须指定允许修改的字段路径，并逐个选择文件。资源名称、头像 ID、引用关系、密钥和未知字段不做递归替换。

## 安装到 PC SillyTavern

将完整安装包内的 `data` 和 `plugins` 文件夹合并到酒馆根目录：

```text
SillyTavern/
  data/default-user/extensions/global-batch-replace/manifest.json
  plugins/global-batch-replace/index.js
```

在 `config.yaml` 中设置 `enableServerPlugins: true` 并重启酒馆。前端只使用 `/api/plugins/global-batch-replace`；新服务端插件自带处理模块，不引用 write-work 或某个固定用户的扩展目录。其他酒馆账号可各自安装前端，共用此服务端插件，服务端按已登录用户隔离资料与扫描任务。

服务端运行库复用酒馆已有 Node 依赖；若定制酒馆缺少依赖，在 `plugins/global-batch-replace` 中运行 `npm install --omit=dev`。安装包内提供 package.json 与锁文件。

## 安装到 TauriTavern

将仅前端包中的 `global-batch-replace` 文件夹复制到 **TT 当前数据目录**的 `default-user/extensions/`，然后重新载入 TT。也可在 TT 的本地扩展导入功能中导入前端 ZIP（以该版本 TT 提供的入口为准）。不要复制到安装目录的 default/scaffold。

TT 不需要 Node 服务端插件。保留既有 TT 原生适配：ABI 2 检查、当前数据目录/资料集绑定、原始 PNG 备份、提交前与提交后校验、逐资源失败恢复、ZIP 备份导入导出、迁移后资料集登记。未知 ABI 或缺少接口时会停止，不回退到 PC 服务端。

TT 中绑定的独立世界书和卡内保存的世界书分别选择。TT 导出角色卡时可能根据绑定书生成内嵌内容，要修改实际绑定的书也需选择该独立世界书。TT 使用逐资源保存，不是跨资源原子事务；执行时暂停其他窗口、设备及同步的编辑。

独立版使用新 namespace `global-batch-replace`。旧工作台的规则、资料集标记和备份保留原位；不会自动接管或恢复旧工作台备份。独立版导出的 TT ZIP 只允许导回同一资料集。换目录后需按界面登记为新资料集，迁移前备份仍可下载，但不直接恢复。

## 备份位置

- PC：当前用户 `backups/global-batch-replace/`。
- TT：当前数据根目录 `_tauritavern/extension-store/global-batch-replace/`。
- 浏览器规则：IndexedDB `global-batch-replace`，不与写卡草稿共用库。

卸载扩展前请导出需要的备份；安装包不包含个人资料、规则或任何业务备份。

## 开发与验证

源码根目录执行 `npm ci`、`npm test`。`npm run package` 会同步服务端共用引擎并生成完整包和 TT 前端包。测试使用临时资料与模拟接口，覆盖扫描、只查找禁止提交、字段白名单、部分选择、冲突、失败恢复、多账号隔离和备份校验。真实手机 TT 尚未验证。

来源说明见 CREDITS.md；TT 适配细节见 TT-COMPATIBILITY.md。本地独立改造不代表原作者发布或维护。
