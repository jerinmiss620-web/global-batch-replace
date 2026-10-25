# 来源与改造记录

- 写卡工作台原项目： https://github.com/akari-taomini/write-work ，本地快照基于提交 `23a09b5` 及本机 2026-10-24～25 的批量处理增补。
- 本独立版抽取该本地增补中的 batch-engine、batch-adapters、batch-panel、batch-runtime、batch-server、batch-tt 和测试；内部滚动函数及 IndexedDB 存储也源自工作台本地代码。保留这份来源记录。
- 独立版新增独立扩展入口、独立样式与存储命名空间、独立配套服务端插件、真正的仅查找任务及禁止提交保护、独立安装包；不包含原工作台的写卡/AI 创作/前端设计功能。
- PNG 重新编码器为本独立版实现，仅复用宿主已有的 crc 包。
- 浏览器 ZIP 库 fflate 随包分发，MIT 许可全文在 vendor/fflate-LICENSE。

原本地扩展快照未附带项目级 LICENSE 文件；此独立版保留来源记录，不改变原代码的权利归属。
