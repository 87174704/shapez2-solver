# F2 候选部署计划（未执行）

F1本地构建、实际浏览器和原有正确性门禁已通过。INFERRED：具备进入F2准备的技术基础；UNKNOWN：中国大陆独立网络可达性与所选公共镜像长期免费条款/SLA。不能给出国内无条件可部署通过。下一步先补充大陆电信/联通/移动等实际采样点的固定URL/SRI/CORS验证；不得使用本机或CDN宣传代替，也不在生产ECS试错。

只有获得下一阶段独立授权后，才可执行下列候选步骤：

1. 固定审阅通过的F1源码Commit、两个Profile清单SHA和资源锁；复核外部CDN字节未漂移。如镜像不可用，另行批准等价替代或经许可审查的本地JS回退，不自动放宽CSP/SRI。
2. 明确GitHub Pages是否启用、发布方式及项目路径/shapez2-solver/。候选上传范围仅dist/global内容，带.nojekyll；不得把整个仓库、Benchmark或.f1缓存发布。没有新增push自动部署工作流。
3. 明确ECS静态根路径或专用子路径，路径改变必须重新构建china，禁止直接手改产物。先在独立预发布目录校验HTML/JS/CSS/WOFF2 MIME、HTTPS、普通目录index/尾斜线、Worker同源与缓存策略；不覆盖现有生产目录。
4. 依据产物CSP核对服务器响应头，不让未知旧策略阻断字体、Worker或可视化；保留SRI与匿名CORS。HTML/CSS/自有JS采用可回滚的一致版本发布策略；不得让旧HTML引用不一致的新文件。
5. 在预发布环境重做初始化、输入、Solver/Mixing Worker、2D/3D、字体/故障回退、locale刷新、网络与CSP检查；同时确认部署范围、备份及回滚目标后才进行被授权的生产切换。
6. 记录实际部署身份和清单哈希，检查预期URL的公开行为。失败时回滚到预先确认的上一版本；不就地修改算法解决部署问题。

预期国际地址是 https://87174704.github.io/shapez2-solver/，本轮未访问该地址来冒充已部署，也未启用Pages。国内生产站点、Gitea与ECS均未修改。F1到此STOP；不自动push、deploy、创建Release、切换生产CDN、做i18n或算法优化。
