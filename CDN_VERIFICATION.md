# CDN 实际内容与可用性验证

日期2026-10-30（Asia/Shanghai）；原始证据时间戳为UTC。VERIFIED仅指实际采样主机与本轮原生Chromium请求，不代表大陆全网可达。

## 最终脚本来源

| 依赖 / Profile | 实际URL | HTTP | SHA-256 | 匿名CORS / 结果 |
| --- | --- | --- | --- | --- |
| cytoscape / global | https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 | * / VERIFIED |
| cytoscape / china | https://jsdelivr.topthink.com/npm/cytoscape@3.29.2/dist/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 | * / VERIFIED |
| elkjs / global | https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js | 200 | b0745abd7f23cd91690a1587e377edbe19fd7233c783300290936720546216d4 | * / VERIFIED |
| elkjs / china | https://jsdelivr.topthink.com/npm/elkjs@0.9.3/lib/elk.bundled.js | 200 | b0745abd7f23cd91690a1587e377edbe19fd7233c783300290936720546216d4 | * / VERIFIED |
| cytoscape-elk / global | https://cdn.jsdelivr.net/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js | 200 | a5d8177d848b6f0ce5a6656a3b0982294f60992c7f9badc7ac0e78b5ab13eacc | * / VERIFIED |
| cytoscape-elk / china | https://jsdelivr.topthink.com/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js | 200 | a5d8177d848b6f0ce5a6656a3b0982294f60992c7f9badc7ac0e78b5ab13eacc | * / VERIFIED |
| three / global | https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js | 200 | 7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585 | * / VERIFIED |
| three / china | https://jsdelivr.topthink.com/npm/three@0.159.0/build/three.min.js | 200 | 7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585 | * / VERIFIED |
| 3d-force-graph / global | https://cdn.jsdelivr.net/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js | 200 | 9dde93387b15d744bdc21ac16f16bb1f114c8aaa0a66815d4bf82e1f10bbd001 | * / VERIFIED |
| 3d-force-graph / china | https://jsdelivr.topthink.com/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js | 200 | 9dde93387b15d744bdc21ac16f16bb1f114c8aaa0a66815d4bf82e1f10bbd001 | * / VERIFIED |

每项均检查HTTPS、响应Content-Type、固定包名/版本、响应正文、最终URL、SHA-256与SHA-384。国际/国内的五对脚本字节完全相同，没有需要忽略的差异。SRI见 resources.lock.json；页面crossorigin=anonymous。两次原生网络复核均成功；浏览器实载也逐项匹配锁定SHA。未将HTTP200的HTML错误页当作JavaScript。

cytoscape-elk的.min.js是CDN生成文件，非npm原包发布的稳定minified字节，当前镜像复制了同一响应。保留RC入口且固定当前SRI，未来重压缩将fail closed；本轮不保证CDN永久保持该SRI，也不无审查更新锁。

Topthink资源可公开请求，无登录、API Key或付费套餐，且实测返回上述内容。UNKNOWN：可单独核验的长期免费服务条款/SLA；其根路径返回404，不将根主页或其他镜像项目的描述当作第一方可用性证明。国内定位属于INFERRED，独立大陆ISP可达性属于UNKNOWN，须在F2前补证。未选择付费方案，也未新增私有服务凭据。

## 候选探测（仅测试下列确切路径）

| URL | HTTP / 网络结果 | SHA-256 |
| --- | --- | --- |
| https://cdn.jsdmirror.cn/npm/cytoscape@3.29.2/dist/cytoscape.min.js | 521 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| https://cdn.bootcdn.net/ajax/libs/cytoscape/3.29.2/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://lib.baomitu.com/cytoscape/3.29.2/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://cdn.staticfile.net/cytoscape/3.29.2/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://jsdelivr.topthink.com/npm/cytoscape@3.29.2/dist/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://jsdelivr.topthink.com/npm/cytoscape@3.29.2/dist/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://cdn.bootcdn.net/ajax/libs/cytoscape/3.29.2/cytoscape.min.js | 200 | 4d1ba05f57890d46e90ffb603e7d665bf9466e1d674e030f93d8e6e63b958587 |
| https://jsdelivr.topthink.com/npm/elkjs@0.9.3/lib/elk.bundled.js | 200 | b0745abd7f23cd91690a1587e377edbe19fd7233c783300290936720546216d4 |
| https://cdn.bootcdn.net/ajax/libs/elkjs/0.9.3/elk.bundled.js | 404 | bf599881101ca656921c4dda25c47259ca8445011ad1fb0a1f39bf9132b0a072 |
| https://jsdelivr.topthink.com/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js | 200 | a5d8177d848b6f0ce5a6656a3b0982294f60992c7f9badc7ac0e78b5ab13eacc |
| https://cdn.bootcdn.net/ajax/libs/cytoscape-elk/2.3.0/cytoscape-elk.min.js | 404 | bf599881101ca656921c4dda25c47259ca8445011ad1fb0a1f39bf9132b0a072 |
| https://jsdelivr.topthink.com/npm/three@0.159.0/build/three.min.js | 200 | 7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585 |
| https://cdn.bootcdn.net/ajax/libs/three.js/0.159.0/three.min.js | 200 | 7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585 |
| https://jsdelivr.topthink.com/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js | 200 | 9dde93387b15d744bdc21ac16f16bb1f114c8aaa0a66815d4bf82e1f10bbd001 |
| https://cdn.bootcdn.net/ajax/libs/3d-force-graph/1.74.7/3d-force-graph.min.js | 404 | bf599881101ca656921c4dda25c47259ca8445011ad1fb0a1f39bf9132b0a072 |

JSDMirror .com 的最初失败详见 .f1/evidence/jsdmirror-failed-probe.json（521）；.cn亦521。BootCDN部分200且字节相同，elkjs/cytoscape-elk/3d-force-graph测试路径404，因此未选；这不推断其其他路径或其他版本一定不可用。Staticfile和Baomitu只验证了Cytoscape候选，没有用其单资源成功推断其全库可用。Topthink五项固定路径均实测，选用单一脚本域减少CSP白名单。

## 字体与许可

Google Fonts CSS实测HTTP200，源码SHA-256 624569983eae7f01f8aafc237d7689627d8925b89d58310380f94af0cffa2cca，Chrome UA返回Barlow分发v13。下面54份WOFF2均HTTP200、Content-Type为font/woff2、匿名CORS=*，并校验wOF2签名；China文件与下载正文完全一致。CSS只修改src URL，保留字重、斜体、unicode-range和swap。实际浏览器每Profile18种style/weight均加载成功；另外刻意屏蔽字体的新页面仍能初始化、运行Solver Worker并求解。

| 本地文件 | Google Fonts固定文件URL | SHA-256 | 结果 |
| --- | --- | --- | --- |
| barlow-0.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHtv4kjgoGqM7E_CfNY8HIJmAci.woff2 | a0e2a4ce70e08fb73874eb7f5be3864f0e4660fc44c3b2e48aeb3fe28d0aaf6d | VERIFIED |
| barlow-1.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHtv4kjgoGqM7E_CfNY8HMJmAci.woff2 | 4ebbdef62b0f8e22dbdde8b2e75f5b7ffdb27dcdf9c1c45a23f2213319b7c7d9 | VERIFIED |
| barlow-2.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHtv4kjgoGqM7E_CfNY8H0JmA.woff2 | b3b429954ed286eb79cfb89271a66f852ed62317e904c58c4f607e33a231537d | VERIFIED |
| barlow-3.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfP04WohvTobdw.woff2 | 3f237049f389015efc308f6541e77ed9040dc1f8c8b1e1a3ed25bb99b446145b | VERIFIED |
| barlow-4.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfP04WogvTobdw.woff2 | 596b8d50d3b584b8f159d4f79885267159949783a88f43887271f458194f730d | VERIFIED |
| barlow-5.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfP04WouvTo.woff2 | dec37c095eaeb5a57884b473c0e61ff6c38f44d8deaa254a3a534d9febb39193 | VERIFIED |
| barlow-6.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOQ4mohvTobdw.woff2 | cd97b18a6009015e7a4e65d3dca6690de571aa805158a852404f684e101c4789 | VERIFIED |
| barlow-7.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOQ4mogvTobdw.woff2 | 6ee4c14c3ece0c2f03cd0ef82645a65a89861612c8804b85dfc878906c908541 | VERIFIED |
| barlow-8.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOQ4mouvTo.woff2 | f6c59bf21b212784adb329f91e2e32aef59a1adf5c23c5140fd4e3f1730142d7 | VERIFIED |
| barlow-9.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E_Cfs0wH8RnA.woff2 | 83dc508fed711b2dc8ff393f97f3b943f66ee2500cc7c4cf889867d024840560 | VERIFIED |
| barlow-10.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E_Cfs1wH8RnA.woff2 | dcc40914416cf9c17ca57deeed46b2eea1749b2b3a57db34147ed0ee004b866b | VERIFIED |
| barlow-11.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E_Cfs7wH8.woff2 | 7a306c56f630df002deeafbd521738e20795d765feea65030def2e80f9a3d62f | VERIFIED |
| barlow-12.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPI42ohvTobdw.woff2 | a18be0a1f14fb278ecac3e0d919bc56304f5cce1081c30bab0f6657ac9a006d4 | VERIFIED |
| barlow-13.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPI42ogvTobdw.woff2 | 48d125ab6f182bc8bb52f8fcdfb82ea4027bcecddc5a962dfef1d5e3fd08369b | VERIFIED |
| barlow-14.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPI42ouvTo.woff2 | 15fff91140576edddc04333d4a03c4634d25e327597db5f855dce6c92023e4ba | VERIFIED |
| barlow-15.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPk5GohvTobdw.woff2 | 356f4dfd8c4d48b4814e3426207366fe7b33aaecdd12ca713593e9689bf7c2e7 | VERIFIED |
| barlow-16.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPk5GogvTobdw.woff2 | b348d5eade8d61fb56782af290ffb68bed4a0ff71df48364b3b6e08ed22c8517 | VERIFIED |
| barlow-17.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfPk5GouvTo.woff2 | 8eccc3c886206556e8aa3d585003d5fc1b8071a4f1d63a04fcd58d4b9a492e92 | VERIFIED |
| barlow-18.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOA5WohvTobdw.woff2 | 30a808a776b20e071f05bf550978f1ff2809d30fce245c0910698cc5bb9b2fc9 | VERIFIED |
| barlow-19.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOA5WogvTobdw.woff2 | cf54080f2ca3711deed8291a944d9f256a96ba0afb41309f30831b686ce488b1 | VERIFIED |
| barlow-20.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOA5WouvTo.woff2 | 717f61f0f8cf46b1f2aa54283e91ae39b1a80c4769ccaa761c7fab813708bcff | VERIFIED |
| barlow-21.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOc5mohvTobdw.woff2 | a0cd642775c3ad8e9014d8d5bb5e074234257145b228e20a00a27ba7b64a33bc | VERIFIED |
| barlow-22.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOc5mogvTobdw.woff2 | ed9a4ca1af613c59351e065bc86e4744dc2bbd295fe926bbefae99261059df26 | VERIFIED |
| barlow-23.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfOc5mouvTo.woff2 | d8f19e32b17e71814c011dfb8f45a766533974263463bc0e6b60faded692db06 | VERIFIED |
| barlow-24.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfO452ohvTobdw.woff2 | 9d660dbd0f437f98efb2c7bdee0f9090e1b735c47a0f113cb46254d9db6c3a67 | VERIFIED |
| barlow-25.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfO452ogvTobdw.woff2 | 0ba304575a6371dc270666321dd922c34af4d9bcffed46068128bd20f2a36f02 | VERIFIED |
| barlow-26.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHsv4kjgoGqM7E_CfO452ouvTo.woff2 | 8cc0dedd7351c607b934e82026d64d55532d3592bdd67a902e038bc3c19dd8c5 | VERIFIED |
| barlow-27.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E3b_s0wH8RnA.woff2 | 0e1d4a296cacbfa2cc3071108b4ab414d903516845a3be32f5607d127e4e2dce | VERIFIED |
| barlow-28.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E3b_s1wH8RnA.woff2 | d145eefba3762a24c761a13c8e588578322b48d6c5df67182adc067c5c4f617f | VERIFIED |
| barlow-29.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHrv4kjgoGqM7E3b_s7wH8.woff2 | 79213a0cddd7c9ee19cdd9e258827d840c5b69d508e88a5c18a85f6fa85cee8d | VERIFIED |
| barlow-30.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3w-os6FospT4.woff2 | 0aff952122d1f7736d224b99a542ec3cfe6c2b2dd85e43e0434c6534cee92a70 | VERIFIED |
| barlow-31.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3w-os6VospT4.woff2 | 98f98ad7afacd9024dbbc5fb3adcce6dc8ce662d110b9df52181fad7ad4d5e6a | VERIFIED |
| barlow-32.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3w-os51os.woff2 | 8452443f54db2db87d5a0efee9a68b42b2775303a5e23b90cbf112e25e03be9e | VERIFIED |
| barlow-33.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3p-ks6FospT4.woff2 | b81915f6cf4c1a474646ebc88b85cb61e3ad7721d42168d9386d89a86a2d86ae | VERIFIED |
| barlow-34.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3p-ks6VospT4.woff2 | 5d396229b78ff1a9abba40931592ce7dd5b67c63ec6137d3a7a165b2356e903e | VERIFIED |
| barlow-35.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3p-ks51os.woff2 | 889347d7bc19d53d984a12f413457fbc8b3723757464cf514121534f626dc4db | VERIFIED |
| barlow-36.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_A8s52Hs.woff2 | fef1e3c39d06f701c21120978484610a6848dc357d1ec603421927d709016b10 | VERIFIED |
| barlow-37.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_Ass52Hs.woff2 | 122b24bc2a90b0abe189f5229768bf2e9ba641324fe2459b48850079625934f1 | VERIFIED |
| barlow-38.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_DMs5.woff2 | b0a8ad37ac45f5fb22ced461576db72e44e295107aad7a9c8a7a4bad728fd03b | VERIFIED |
| barlow-39.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs6FospT4.woff2 | ba426fe513fa9e7e053ae6cf15132bb0ee3a076c634d0a02a0d221c66d74ea5e | VERIFIED |
| barlow-40.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs6VospT4.woff2 | 3facdf66b60778c7e64693013be7799e6686b2488dad65525b4036e211ab03e0 | VERIFIED |
| barlow-41.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs51os.woff2 | cd759df8ef9efc98fee14307b4eb5ba27f08b1f8f2f3ad2872432e25c89907a8 | VERIFIED |
| barlow-42.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s6FospT4.woff2 | d9bb523921d15e2b3fca0b22860af8b6f4a878a54c0bddd7c522588988253943 | VERIFIED |
| barlow-43.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s6VospT4.woff2 | b7f099c421968b583734bc631e6706bff8fc23908112a219f5f0e37f59b03b32 | VERIFIED |
| barlow-44.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s51os.woff2 | 4b52ddd4836b592df0e4832b8286956883cdc651b015126bdd18f184b7f90cc3 | VERIFIED |
| barlow-45.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4s6FospT4.woff2 | 73b48c8588dc2bf62ee6c47f6e5d3074dd4098e1cc3f9082752f0d5776097d66 | VERIFIED |
| barlow-46.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4s6VospT4.woff2 | 88c786d5fa8700a201615bc7b8ede09d209ec5d08cc3dd0a30ea1c4baff3476f | VERIFIED |
| barlow-47.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4s51os.woff2 | 2d797dd8b35dcb3413e1af9d7052b3f4f8c341a147cdcb01f4f06af80db53289 | VERIFIED |
| barlow-48.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3q-0s6FospT4.woff2 | dccc9bb5cc1035edaf1420572012f17b6d6a315ac900d97195035e3ac005c786 | VERIFIED |
| barlow-49.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3q-0s6VospT4.woff2 | 1647a6cc123594599e459587d251f034e2f28bac2fec980bd0933c3ad13ce5e8 | VERIFIED |
| barlow-50.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3q-0s51os.woff2 | 231d487a993e28bc5567c2be8da48acd8e0a209891c11448491eab45db0f8d7c | VERIFIED |
| barlow-51.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3j-ws6FospT4.woff2 | a5441aef37e84a12c5ddc37b431f55bacb40fef97d245e9112ec422f85d6bd37 | VERIFIED |
| barlow-52.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3j-ws6VospT4.woff2 | ff236c2a65201d5d0213138c1721fdc7075d5691e556fda9e0a129b826dd0a85 | VERIFIED |
| barlow-53.woff2 | https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3j-ws51os.woff2 | 6f5d995ccc4d8ffd9e8cb4c303fc1f3646d6c62d40269ef59463332f12d5b897 | VERIFIED |

OFL来源：[固定Google Fonts提交](https://cdn.jsdelivr.net/gh/google/fonts@6cdf01867df0813c2390f90dff7dc66c87f14cf7/ofl/barlow/OFL.txt)；完整OFL与版权已复制到third-party/barlow/OFL.txt及两个产物。其SHA-256 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f 与RC许可快照相同。脚本包级许可证分别为MIT、EPL-2.0等，来源和SHA在resources.lock.json，完整文本在third-party/licenses；JS仍由CDN加载，无新增本地JS回退，也不将既有bundle的包级许可夸大为完整传递依赖SBOM。

Global字体CSS是原RC的动态接口，不能保证将来所有UA收到相同字节；不对它设置错误SRI。China没有Google字体运行期请求。字体回退不等于关闭CSP或绕过SRI。

资源选型参考仅用于发现候选，实际结果以上表为准：[BootCDN自身说明](https://www.bootcdn.cn/)、[JSDMirror官方项目](https://github.com/jsdmirror/JSDMirror)。
