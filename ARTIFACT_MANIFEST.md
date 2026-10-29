# 静态产物清单

VERIFIED：两份产物由同一应用RC和同一工具源码生成。应用RC Commit ec9cc5cb633d021b6af276565223a392f8329b87，Tree 4e49a58cd2d89923ebea189ffbfc9ab9b1049d87。Source Commit 6faee896e51979359284736f78ab820d7ab4d110，Source Tree 0b38e4b110ec605fdc11f103ebd2d103513d1646。Profile分别global与china；构建工具shapez2-static-build/1.0.0，Node v24.21.0。工具版本、工具文件SHA、第三方固定版本、最终CDN URL、SRI、每文件SHA和字节数详见各产物build-manifest.json。清单不写构建时间或本地绝对路径，不包含自身递归哈希；本文件另列其SHA。

global清单SHA-256：d2728aec898445a7ba153765c509f394e27376dbea2b553d4a832a41bd83dedd。
china清单SHA-256：2112839a4426a255b41b173b4418c06e16750f6c87413cd39fc056bdb65bcf31。

重复相同配置构建结果一致。27个自有JS完全相同，shapeOperations.js SHA-256 3052ea5686bf7808cdefbee0d58347b3dcef812ea694d0a23bf1749e1be0bcc9；语义聚合 28aac91525a7f15a1ab081ed73f425f39f4f2e68d30599fbf8b46e1a9bf09a97。所有源RC文件无内容差异、461个冻结Benchmark匹配，产物未包括Benchmark测试缓存、node_modules、Git元数据、本地绝对路径或凭据。字体等二进制由许可与资源锁绑定。

## 每个不同路径及理由

| 路径 | 差异说明 |
| --- | --- |
| assets/fonts/barlow-0.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-1.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-10.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-11.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-12.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-13.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-14.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-15.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-16.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-17.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-18.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-19.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-2.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-20.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-21.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-22.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-23.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-24.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-25.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-26.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-27.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-28.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-29.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-3.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-30.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-31.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-32.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-33.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-34.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-35.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-36.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-37.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-38.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-39.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-4.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-40.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-41.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-42.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-43.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-44.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-45.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-46.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-47.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-48.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-49.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-5.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-50.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-51.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-52.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-53.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-6.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-7.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-8.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow-9.woff2 | China-only licensed local Barlow font snapshot |
| assets/fonts/barlow.css | China-only licensed local Barlow font snapshot |
| build-manifest.json | Profile, base path, font/CDN configuration and artifact digests |
| cn/index.html | CDN URLs, profile CSP and configured base path; SRI/order and application markup identical |
| en/index.html | CDN URLs, profile CSP and configured base path; SRI/order and application markup identical |
| index.html | CDN URLs, profile CSP and configured base path; SRI/order and application markup identical |
| styles.css | Only Barlow @import source differs |

## 全部产物文件SHA-256

| 相对路径 | global SHA-256 | china SHA-256 |
| --- | --- | --- |
| .nojekyll | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| LICENSE | 5bcf6a243f2bda96ef3d8ab09af5da8af1e682037b9dc38fa76c75650bdd4633 | 5bcf6a243f2bda96ef3d8ab09af5da8af1e682037b9dc38fa76c75650bdd4633 |
| assets/fonts/barlow-0.woff2 | 不包含 | a0e2a4ce70e08fb73874eb7f5be3864f0e4660fc44c3b2e48aeb3fe28d0aaf6d |
| assets/fonts/barlow-1.woff2 | 不包含 | 4ebbdef62b0f8e22dbdde8b2e75f5b7ffdb27dcdf9c1c45a23f2213319b7c7d9 |
| assets/fonts/barlow-10.woff2 | 不包含 | dcc40914416cf9c17ca57deeed46b2eea1749b2b3a57db34147ed0ee004b866b |
| assets/fonts/barlow-11.woff2 | 不包含 | 7a306c56f630df002deeafbd521738e20795d765feea65030def2e80f9a3d62f |
| assets/fonts/barlow-12.woff2 | 不包含 | a18be0a1f14fb278ecac3e0d919bc56304f5cce1081c30bab0f6657ac9a006d4 |
| assets/fonts/barlow-13.woff2 | 不包含 | 48d125ab6f182bc8bb52f8fcdfb82ea4027bcecddc5a962dfef1d5e3fd08369b |
| assets/fonts/barlow-14.woff2 | 不包含 | 15fff91140576edddc04333d4a03c4634d25e327597db5f855dce6c92023e4ba |
| assets/fonts/barlow-15.woff2 | 不包含 | 356f4dfd8c4d48b4814e3426207366fe7b33aaecdd12ca713593e9689bf7c2e7 |
| assets/fonts/barlow-16.woff2 | 不包含 | b348d5eade8d61fb56782af290ffb68bed4a0ff71df48364b3b6e08ed22c8517 |
| assets/fonts/barlow-17.woff2 | 不包含 | 8eccc3c886206556e8aa3d585003d5fc1b8071a4f1d63a04fcd58d4b9a492e92 |
| assets/fonts/barlow-18.woff2 | 不包含 | 30a808a776b20e071f05bf550978f1ff2809d30fce245c0910698cc5bb9b2fc9 |
| assets/fonts/barlow-19.woff2 | 不包含 | cf54080f2ca3711deed8291a944d9f256a96ba0afb41309f30831b686ce488b1 |
| assets/fonts/barlow-2.woff2 | 不包含 | b3b429954ed286eb79cfb89271a66f852ed62317e904c58c4f607e33a231537d |
| assets/fonts/barlow-20.woff2 | 不包含 | 717f61f0f8cf46b1f2aa54283e91ae39b1a80c4769ccaa761c7fab813708bcff |
| assets/fonts/barlow-21.woff2 | 不包含 | a0cd642775c3ad8e9014d8d5bb5e074234257145b228e20a00a27ba7b64a33bc |
| assets/fonts/barlow-22.woff2 | 不包含 | ed9a4ca1af613c59351e065bc86e4744dc2bbd295fe926bbefae99261059df26 |
| assets/fonts/barlow-23.woff2 | 不包含 | d8f19e32b17e71814c011dfb8f45a766533974263463bc0e6b60faded692db06 |
| assets/fonts/barlow-24.woff2 | 不包含 | 9d660dbd0f437f98efb2c7bdee0f9090e1b735c47a0f113cb46254d9db6c3a67 |
| assets/fonts/barlow-25.woff2 | 不包含 | 0ba304575a6371dc270666321dd922c34af4d9bcffed46068128bd20f2a36f02 |
| assets/fonts/barlow-26.woff2 | 不包含 | 8cc0dedd7351c607b934e82026d64d55532d3592bdd67a902e038bc3c19dd8c5 |
| assets/fonts/barlow-27.woff2 | 不包含 | 0e1d4a296cacbfa2cc3071108b4ab414d903516845a3be32f5607d127e4e2dce |
| assets/fonts/barlow-28.woff2 | 不包含 | d145eefba3762a24c761a13c8e588578322b48d6c5df67182adc067c5c4f617f |
| assets/fonts/barlow-29.woff2 | 不包含 | 79213a0cddd7c9ee19cdd9e258827d840c5b69d508e88a5c18a85f6fa85cee8d |
| assets/fonts/barlow-3.woff2 | 不包含 | 3f237049f389015efc308f6541e77ed9040dc1f8c8b1e1a3ed25bb99b446145b |
| assets/fonts/barlow-30.woff2 | 不包含 | 0aff952122d1f7736d224b99a542ec3cfe6c2b2dd85e43e0434c6534cee92a70 |
| assets/fonts/barlow-31.woff2 | 不包含 | 98f98ad7afacd9024dbbc5fb3adcce6dc8ce662d110b9df52181fad7ad4d5e6a |
| assets/fonts/barlow-32.woff2 | 不包含 | 8452443f54db2db87d5a0efee9a68b42b2775303a5e23b90cbf112e25e03be9e |
| assets/fonts/barlow-33.woff2 | 不包含 | b81915f6cf4c1a474646ebc88b85cb61e3ad7721d42168d9386d89a86a2d86ae |
| assets/fonts/barlow-34.woff2 | 不包含 | 5d396229b78ff1a9abba40931592ce7dd5b67c63ec6137d3a7a165b2356e903e |
| assets/fonts/barlow-35.woff2 | 不包含 | 889347d7bc19d53d984a12f413457fbc8b3723757464cf514121534f626dc4db |
| assets/fonts/barlow-36.woff2 | 不包含 | fef1e3c39d06f701c21120978484610a6848dc357d1ec603421927d709016b10 |
| assets/fonts/barlow-37.woff2 | 不包含 | 122b24bc2a90b0abe189f5229768bf2e9ba641324fe2459b48850079625934f1 |
| assets/fonts/barlow-38.woff2 | 不包含 | b0a8ad37ac45f5fb22ced461576db72e44e295107aad7a9c8a7a4bad728fd03b |
| assets/fonts/barlow-39.woff2 | 不包含 | ba426fe513fa9e7e053ae6cf15132bb0ee3a076c634d0a02a0d221c66d74ea5e |
| assets/fonts/barlow-4.woff2 | 不包含 | 596b8d50d3b584b8f159d4f79885267159949783a88f43887271f458194f730d |
| assets/fonts/barlow-40.woff2 | 不包含 | 3facdf66b60778c7e64693013be7799e6686b2488dad65525b4036e211ab03e0 |
| assets/fonts/barlow-41.woff2 | 不包含 | cd759df8ef9efc98fee14307b4eb5ba27f08b1f8f2f3ad2872432e25c89907a8 |
| assets/fonts/barlow-42.woff2 | 不包含 | d9bb523921d15e2b3fca0b22860af8b6f4a878a54c0bddd7c522588988253943 |
| assets/fonts/barlow-43.woff2 | 不包含 | b7f099c421968b583734bc631e6706bff8fc23908112a219f5f0e37f59b03b32 |
| assets/fonts/barlow-44.woff2 | 不包含 | 4b52ddd4836b592df0e4832b8286956883cdc651b015126bdd18f184b7f90cc3 |
| assets/fonts/barlow-45.woff2 | 不包含 | 73b48c8588dc2bf62ee6c47f6e5d3074dd4098e1cc3f9082752f0d5776097d66 |
| assets/fonts/barlow-46.woff2 | 不包含 | 88c786d5fa8700a201615bc7b8ede09d209ec5d08cc3dd0a30ea1c4baff3476f |
| assets/fonts/barlow-47.woff2 | 不包含 | 2d797dd8b35dcb3413e1af9d7052b3f4f8c341a147cdcb01f4f06af80db53289 |
| assets/fonts/barlow-48.woff2 | 不包含 | dccc9bb5cc1035edaf1420572012f17b6d6a315ac900d97195035e3ac005c786 |
| assets/fonts/barlow-49.woff2 | 不包含 | 1647a6cc123594599e459587d251f034e2f28bac2fec980bd0933c3ad13ce5e8 |
| assets/fonts/barlow-5.woff2 | 不包含 | dec37c095eaeb5a57884b473c0e61ff6c38f44d8deaa254a3a534d9febb39193 |
| assets/fonts/barlow-50.woff2 | 不包含 | 231d487a993e28bc5567c2be8da48acd8e0a209891c11448491eab45db0f8d7c |
| assets/fonts/barlow-51.woff2 | 不包含 | a5441aef37e84a12c5ddc37b431f55bacb40fef97d245e9112ec422f85d6bd37 |
| assets/fonts/barlow-52.woff2 | 不包含 | ff236c2a65201d5d0213138c1721fdc7075d5691e556fda9e0a129b826dd0a85 |
| assets/fonts/barlow-53.woff2 | 不包含 | 6f5d995ccc4d8ffd9e8cb4c303fc1f3646d6c62d40269ef59463332f12d5b897 |
| assets/fonts/barlow-6.woff2 | 不包含 | cd97b18a6009015e7a4e65d3dca6690de571aa805158a852404f684e101c4789 |
| assets/fonts/barlow-7.woff2 | 不包含 | 6ee4c14c3ece0c2f03cd0ef82645a65a89861612c8804b85dfc878906c908541 |
| assets/fonts/barlow-8.woff2 | 不包含 | f6c59bf21b212784adb329f91e2e32aef59a1adf5c23c5140fd4e3f1730142d7 |
| assets/fonts/barlow-9.woff2 | 不包含 | 83dc508fed711b2dc8ff393f97f3b943f66ee2500cc7c4cf889867d024840560 |
| assets/fonts/barlow.css | 不包含 | 150d74692b42f234783f749701f1782b2861ab97835160c4a3c3b3f0ba8ca3ab |
| bestFirstPlanSolver.js | 1fa6346166b2006eb58ee527628e3048f4d056e6a6c1c1c619d957d61c4f609e | 1fa6346166b2006eb58ee527628e3048f4d056e6a6c1c1c619d957d61c4f609e |
| build-manifest.json | d2728aec898445a7ba153765c509f394e27376dbea2b553d4a832a41bd83dedd | 2112839a4426a255b41b173b4418c06e16750f6c87413cd39fc056bdb65bcf31 |
| cn/index.html | b94d678dc0f3052359d9baf9e4e94deab0d240e794c44460a1e1518c1532c159 | 89f382db38a9952e9115579af11cd7b3426a242355ef13dd9b39bb2f3a3b4018 |
| colorMode.js | b068857f8cd9a3d2495da4639a69f8b8a281001bf5e33cc12ab239c15e026b5d | b068857f8cd9a3d2495da4639a69f8b8a281001bf5e33cc12ab239c15e026b5d |
| constructive/crystal-construction-planner.js | 9d601f9a0424e4385352c84ae833b79315c33e77bd2bc02aba70742598c2143f | 9d601f9a0424e4385352c84ae833b79315c33e77bd2bc02aba70742598c2143f |
| constructive/interior-crystal-column-planner.js | 29fad99c70406d89a92010b8b5ec0cf24f2388bc56dea24583228d2bceccf8f6 | 29fad99c70406d89a92010b8b5ec0cf24f2388bc56dea24583228d2bceccf8f6 |
| constructive/mixed-pin-crystal-construction-planner.js | 09bfbf8f8e66f2ef9ea22212871790daf7f12c59560ce88543e21597362529eb | 09bfbf8f8e66f2ef9ea22212871790daf7f12c59560ce88543e21597362529eb |
| constructive/pin-construction-planner.js | 92e49ea9c90c6d513c4a72b11ce582998f963ba8593498edca32da8fa4b3d3ef | 92e49ea9c90c6d513c4a72b11ce582998f963ba8593498edca32da8fa4b3d3ef |
| constructiveSolverRuntime.js | fa6be4c6a2ca264a8c698830d568bc8f3d7b657bdc44b07590687cf8a90a0a3a | fa6be4c6a2ca264a8c698830d568bc8f3d7b657bdc44b07590687cf8a90a0a3a |
| crystalScaffoldGoalDecomposedSolver.js | 51a129abdd2e8a2d573af0fbde05a43ed8cb616d0b46a19b7ff758e118b7d79f | 51a129abdd2e8a2d573af0fbde05a43ed8cb616d0b46a19b7ff758e118b7d79f |
| docs/legal/ATTRIBUTION.md | ce89da5c98b0a537d6bdc689ed07b67ff29131b0e9497ed2a01a92d94876e18e | ce89da5c98b0a537d6bdc689ed07b67ff29131b0e9497ed2a01a92d94876e18e |
| docs/legal/LICENSING.md | cc2b87742f987b4e196d061790157a11ca031ab34e9d018395e17b9ca5125d5f | cc2b87742f987b4e196d061790157a11ca031ab34e9d018395e17b9ca5125d5f |
| docs/legal/THIRD_PARTY.md | aca6b9a389eac94726d7f69590cb5eb2e44e0f548cffadd3656abf0bb9cc5ae6 | aca6b9a389eac94726d7f69590cb5eb2e44e0f548cffadd3656abf0bb9cc5ae6 |
| docs/legal/UPSTREAM_LICENSE.txt | e52f6008adf2d3667e33dc7c8708418aedb575934bcdf770d42a20d02f47c442 | e52f6008adf2d3667e33dc7c8708418aedb575934bcdf770d42a20d02f47c442 |
| docs/legal/licenses/3d-force-graph-1.74.7-package__LICENSE | 7262e566e874d1ce8cfadace01d4f635f8d704b6bdf7b4345cc028e5faeafded | 7262e566e874d1ce8cfadace01d4f635f8d704b6bdf7b4345cc028e5faeafded |
| docs/legal/licenses/Barlow-OFL-1.1.txt | 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f | 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f |
| docs/legal/licenses/Loupau38-shapez2-python-MIT.txt | c9d4342de3ed5aaf65921eca945996f9335a38ef45801315829f700219a07108 | c9d4342de3ed5aaf65921eca945996f9335a38ef45801315829f700219a07108 |
| docs/legal/licenses/Loupau38-viewer-MIT.txt | c687ca3c644a32c4fae6b8d48bee6223bcab3d85fb4a3404c84b33122284dab8 | c687ca3c644a32c4fae6b8d48bee6223bcab3d85fb4a3404c84b33122284dab8 |
| docs/legal/licenses/ajv-8.17.1-package__LICENSE | a05350a88e318e4f5f2c2a1ff1e2e88daa4dd38e6e78b71cccae422bdc762cc3 | a05350a88e318e4f5f2c2a1ff1e2e88daa4dd38e6e78b71cccae422bdc762cc3 |
| docs/legal/licenses/cytoscape-3.29.2-package__LICENSE | a29c0d78a54de204b78357976c3d272a573b8592d0478b9db07af3f1da31a65a | a29c0d78a54de204b78357976c3d272a573b8592d0478b9db07af3f1da31a65a |
| docs/legal/licenses/cytoscape-elk-2.3.0-package__LICENSE | 0ce4ff4d3a334ae70cf389e0e9095b6ea6ef7110b27d2728a32bb5a7f84ed064 | 0ce4ff4d3a334ae70cf389e0e9095b6ea6ef7110b27d2728a32bb5a7f84ed064 |
| docs/legal/licenses/elkjs-0.9.3-package__LICENSE.md | 89591d4578fb1ebd91501312a3d25f021bd865a2e436641c1cf7b1bc7e3c1617 | 89591d4578fb1ebd91501312a3d25f021bd865a2e436641c1cf7b1bc7e3c1617 |
| docs/legal/licenses/fast-deep-equal-3.1.3-package__LICENSE | 7bf9b2de73a6b356761c948d0e9eeb4be6c1270bd04c79cd489c1e400ffdfc1a | 7bf9b2de73a6b356761c948d0e9eeb4be6c1270bd04c79cd489c1e400ffdfc1a |
| docs/legal/licenses/fast-uri-3.1.8-package__LICENSE | b010b0dfdfdb23d7396e03b82cd4621fc9bb8f95d6b0aea70b9c24e12074c786 | b010b0dfdfdb23d7396e03b82cd4621fc9bb8f95d6b0aea70b9c24e12074c786 |
| docs/legal/licenses/json-schema-traverse-1.0.0-package__LICENSE | 7bf9b2de73a6b356761c948d0e9eeb4be6c1270bd04c79cd489c1e400ffdfc1a | 7bf9b2de73a6b356761c948d0e9eeb4be6c1270bd04c79cd489c1e400ffdfc1a |
| docs/legal/licenses/require-from-string-2.0.2-package__license | 6ee0feb1f6ef996ff5a68600f8cf98909cf412d39ef3cdceaefd87d636fa1b7f | 6ee0feb1f6ef996ff5a68600f8cf98909cf412d39ef3cdceaefd87d636fa1b7f |
| docs/legal/licenses/three-0.159.0-package__LICENSE | 852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d | 852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d |
| docs/legal/licenses/three-0.159.0-package__examples__fonts__LICENSE | 35e8279356d7890871c4fce804d157e3f21456a7311ef2caab5cb4705c71b6bd | 35e8279356d7890871c4fce804d157e3f21456a7311ef2caab5cb4705c71b6bd |
| docs/legal/licenses/three-0.159.0-package__examples__fonts__droid__NOTICE | 38751245389e1e23f73e6f5384b5cbe7fa972cc4410c5adc9c04b082a0b9561a | 38751245389e1e23f73e6f5384b5cbe7fa972cc4410c5adc9c04b082a0b9561a |
| en/index.html | 7a8cea6a59e94b90819029be95f4737c0f9b9c9f8918f375ee86c16d994a50ba | d371f0aa7faea826d1015d92d43e06754a694fce5725832d200cdf5e69735f6f |
| goalDecomposedSolver.js | fdb286700fba1204d7434fe36d0a4cd53cd6c3c6476e95ae37e3bf11dadbcf26 | fdb286700fba1204d7434fe36d0a4cd53cd6c3c6476e95ae37e3bf11dadbcf26 |
| i18n.js | f90233a4b1a755b8d5e99119565c0d41f42ebe2e9b2d037f99698bec87a8c75a | f90233a4b1a755b8d5e99119565c0d41f42ebe2e9b2d037f99698bec87a8c75a |
| images/clipboard-copy.png | d4a98e277b16c725ab9f2c22e9cbe3c527518ea275be904baf7348ef2da41705 | d4a98e277b16c725ab9f2c22e9cbe3c527518ea275be904baf7348ef2da41705 |
| images/clipboard.png | 16ebe145365c8fd552a53b82fb136ba852dbe7b901fda8ab852eb31fd2cb4e1f | 16ebe145365c8fd552a53b82fb136ba852dbe7b901fda8ab852eb31fd2cb4e1f |
| images/duplicate.png | 2c4ce8d0b9d8b3ee4edcc12a33908dd62cee83eec8c57217b8d3ab923e8b462e | 2c4ce8d0b9d8b3ee4edcc12a33908dd62cee83eec8c57217b8d3ab923e8b462e |
| images/favicon.ico | ca2b87b1af1734c821ab8477a72c89ac87bdbe46af82e9078a7d3f14f6921936 | ca2b87b1af1734c821ab8477a72c89ac87bdbe46af82e9078a7d3f14f6921936 |
| images/favicon2.ico | a4b84576b83adfdb00c5795f3f0df878f63381524ffce4f9cb66039ee791f1cd | a4b84576b83adfdb00c5795f3f0df878f63381524ffce4f9cb66039ee791f1cd |
| images/fluids.png | 7e2047f0414da651aa3eea8b03f1545bed6418d8e2060e49250224a31e4441ce | 7e2047f0414da651aa3eea8b03f1545bed6418d8e2060e49250224a31e4441ce |
| images/link.png | 15469be7881c96550fa96df9d6e1b4b3864296a4ecb3e108054a1a8d42c7bd4d | 15469be7881c96550fa96df9d6e1b4b3864296a4ecb3e108054a1a8d42c7bd4d |
| images/nodes.png | 949e33a92455dd7616d0e9e84482f53e25b38b07a70dc46918ffc1c60a80e317 | 949e33a92455dd7616d0e9e84482f53e25b38b07a70dc46918ffc1c60a80e317 |
| images/operations/color-mixer.png | 3cd278217db6f4107f19406aab2137e179885538684394f93fbce98491f3d87a | 3cd278217db6f4107f19406aab2137e179885538684394f93fbce98491f3d87a |
| images/operations/crystal-generator.png | 9d6e1c3bb7b5016241b3b34144c5153057126f3150629b6cbf31553cf4b61335 | 9d6e1c3bb7b5016241b3b34144c5153057126f3150629b6cbf31553cf4b61335 |
| images/operations/crystal-generator2.png | 65b92da62ee6af51e84f542d0158a797d309063dad1902a050c23752a1d4e1a8 | 65b92da62ee6af51e84f542d0158a797d309063dad1902a050c23752a1d4e1a8 |
| images/operations/cutter.png | f119d2894f9282bc5665c49b978937db40aa2183a80ef31e4b263a11d3c881c2 | f119d2894f9282bc5665c49b978937db40aa2183a80ef31e4b263a11d3c881c2 |
| images/operations/cutter2.png | 43566c0c002d49269aecf3bfed55ab1f0df627bdbc6b87b0279fac161da8535b | 43566c0c002d49269aecf3bfed55ab1f0df627bdbc6b87b0279fac161da8535b |
| images/operations/half-destroyer.png | 1156908f3b692aa02eabedd49e1cd6dd49ee381e81ca9d4262f4267c9adae429 | 1156908f3b692aa02eabedd49e1cd6dd49ee381e81ca9d4262f4267c9adae429 |
| images/operations/painter.png | aa518e2dd023c12996334bd8c24591bec0bdfaa35ab26db30897745ba365bc70 | aa518e2dd023c12996334bd8c24591bec0bdfaa35ab26db30897745ba365bc70 |
| images/operations/pin-pusher.png | cfe734e25c8e53e0e240b9d10f972cc6440d00dfc6ac79b806f72c4d9baa8cb1 | cfe734e25c8e53e0e240b9d10f972cc6440d00dfc6ac79b806f72c4d9baa8cb1 |
| images/operations/pin-pusher2.png | 7982a8f802002d6805489dd444012370a856a2d9899a29412d770b9dd42f9045 | 7982a8f802002d6805489dd444012370a856a2d9899a29412d770b9dd42f9045 |
| images/operations/rotator-180.png | c51f96533ae4eec9a208d89cc052d4a179f8f12e7306b440f36c36f22941641a | c51f96533ae4eec9a208d89cc052d4a179f8f12e7306b440f36c36f22941641a |
| images/operations/rotator-ccw.png | 678b294606a9e090673bbac82a0aadf13c1298e8951f2bf5db4c9c4f96403fad | 678b294606a9e090673bbac82a0aadf13c1298e8951f2bf5db4c9c4f96403fad |
| images/operations/rotator-cw.png | d14bda0847508b28a915cab22a179f44839c15f2a62e42048745d7c4e0f756fb | d14bda0847508b28a915cab22a179f44839c15f2a62e42048745d7c4e0f756fb |
| images/operations/splitter.png | 7fd90d1d003c30e90397fa563c40c11f2052ca4ab89134a934cb65eee8ea5c24 | 7fd90d1d003c30e90397fa563c40c11f2052ca4ab89134a934cb65eee8ea5c24 |
| images/operations/stacker.png | a38b9e57e39884f8d8d1299336a06599633bf272fe359f10e4ef6e427c2cac5c | a38b9e57e39884f8d8d1299336a06599633bf272fe359f10e4ef6e427c2cac5c |
| images/operations/swapper.png | dfd08efe3fb33c1df97609b12ded0449e7b8a9b0d2607f982ce752a2eae4eb0e | dfd08efe3fb33c1df97609b12ded0449e7b8a9b0d2607f982ce752a2eae4eb0e |
| images/processor.png | a889ec4a61729400cbd126ea23b014d74067ba6a33ce8fe2836c72a099d9f810 | a889ec4a61729400cbd126ea23b014d74067ba6a33ce8fe2836c72a099d9f810 |
| images/shapes.png | 915b719fab543271b9918c8576e0ba64035f04398bfc42029f43fcbe973c7b18 | 915b719fab543271b9918c8576e0ba64035f04398bfc42029f43fcbe973c7b18 |
| images/trades.png | 91d841d5f9219a76340527a66689cf8e29d7425c94d6e3dd3ca27d1423e148eb | 91d841d5f9219a76340527a66689cf8e29d7425c94d6e3dd3ca27d1423e148eb |
| images/trades2.png | 07dc8cb0e3a5f9d22902f299404f697d60b849d6c5b9b0e3c45701a379921d24 | 07dc8cb0e3a5f9d22902f299404f697d60b849d6c5b9b0e3c45701a379921d24 |
| images/trash.png | 999f318a7c2e84fb1b3d1d0efaade4fdbd93223952efe98ccfcbe4a1a7c39690 | 999f318a7c2e84fb1b3d1d0efaade4fdbd93223952efe98ccfcbe4a1a7c39690 |
| index.html | 7a8cea6a59e94b90819029be95f4737c0f9b9c9f8918f375ee86c16d994a50ba | d371f0aa7faea826d1015d92d43e06754a694fce5725832d200cdf5e69735f6f |
| interiorCrystalColumnSolver.js | 8d797fc93a9c734150fa1627a89ec68906944a392dc1fec4e02dbe870f1b9b75 | 8d797fc93a9c734150fa1627a89ec68906944a392dc1fec4e02dbe870f1b9b75 |
| isolatedPinGoalDecomposedSolver.js | 46fa6e3e58a536b72e4e17098c55136e2c117f221b59b20021641f9ed615a009 | 46fa6e3e58a536b72e4e17098c55136e2c117f221b59b20021641f9ed615a009 |
| main.js | 5767038c930532c5aa6a9b20f5e5e25839a8816e4f611a238d0bf7154fb80490 | 5767038c930532c5aa6a9b20f5e5e25839a8816e4f611a238d0bf7154fb80490 |
| mixedPinCrystalGoalDecomposedSolver.js | b704b4b6e61cdb9c2f49cd5eaf878630474fada2f323ee92b8a8a5edab2b8e2e | b704b4b6e61cdb9c2f49cd5eaf878630474fada2f323ee92b8a8a5edab2b8e2e |
| mixingSolver.js | 3124eaaebc33a0a7419e502df7d5d5da9e05e3f530b6fa95946d73a368514c1a | 3124eaaebc33a0a7419e502df7d5d5da9e05e3f530b6fa95946d73a368514c1a |
| operationGraph.js | 004a99b78cdd3a7a08008250800ccb4a4cb971636d0690c367d14c3557e05cb8 | 004a99b78cdd3a7a08008250800ccb4a4cb971636d0690c367d14c3557e05cb8 |
| pinGoalDecomposedSolver.js | 6ccf166b56cc36538d13721a2713cecc4876a30074a1268d37c043a8da3230f7 | 6ccf166b56cc36538d13721a2713cecc4876a30074a1268d37c043a8da3230f7 |
| release.json | 8ea4a5421dc23ecd7097510ab7743d07d9b27523eae2942330c2176b36632fff | 8ea4a5421dc23ecd7097510ab7743d07d9b27523eae2942330c2176b36632fff |
| shapeConstants.js | 81d04e69c1ba2711c6c425b34bb98ea89edeea93bf1a479fdf8c35ffc9594444 | 81d04e69c1ba2711c6c425b34bb98ea89edeea93bf1a479fdf8c35ffc9594444 |
| shapeOperations.js | 3052ea5686bf7808cdefbee0d58347b3dcef812ea694d0a23bf1749e1be0bcc9 | 3052ea5686bf7808cdefbee0d58347b3dcef812ea694d0a23bf1749e1be0bcc9 |
| shapeRendering.js | 6c70dbd1385e1d5785163bde1d7606b84c0b8e1fee453090ca00fc792f69876a | 6c70dbd1385e1d5785163bde1d7606b84c0b8e1fee453090ca00fc792f69876a |
| shapeSolver.js | 24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad | 24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad |
| shapeSolver_web.js | 24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad | 24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad |
| shapeValidation.js | b624fca8098d3bea752db1961bae2fb07ad3b7e30166c0df252775e2dd33f854 | b624fca8098d3bea752db1961bae2fb07ad3b7e30166c0df252775e2dd33f854 |
| sharedOccurrenceGoalDecomposedSolver.js | b4bfbe2a096608f119ea28b1c72239fdf4e75fb2e97ad00c458ca91cbca64e63 | b4bfbe2a096608f119ea28b1c72239fdf4e75fb2e97ad00c458ca91cbca64e63 |
| styles.css | d1ab99e034152de78dca5f7efdcd636e2aacd22cb1d784abfe5bd74c0ae17bcf | 2800833ffde2cd8c1dbc7f2e77ebf6e6a5e32fa8c7c1e76ef06df8868d660d6d |
| targetConditionedSolver.js | bcc138a0613b329a5f6a87c63f60c4c31dbaeaadc48f31a4d1a08eab64e694d4 | bcc138a0613b329a5f6a87c63f60c4c31dbaeaadc48f31a4d1a08eab64e694d4 |
| third-party/NOTICE.md | b2a85ca17e1c1df40717156120118c242705a0810fc9692502829281a5188722 | b2a85ca17e1c1df40717156120118c242705a0810fc9692502829281a5188722 |
| third-party/barlow/OFL.txt | 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f | 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f |
| third-party/licenses/3d-force-graph-LICENSE | 7262e566e874d1ce8cfadace01d4f635f8d704b6bdf7b4345cc028e5faeafded | 7262e566e874d1ce8cfadace01d4f635f8d704b6bdf7b4345cc028e5faeafded |
| third-party/licenses/cytoscape-LICENSE | a29c0d78a54de204b78357976c3d272a573b8592d0478b9db07af3f1da31a65a | a29c0d78a54de204b78357976c3d272a573b8592d0478b9db07af3f1da31a65a |
| third-party/licenses/cytoscape-elk-LICENSE | 0ce4ff4d3a334ae70cf389e0e9095b6ea6ef7110b27d2728a32bb5a7f84ed064 | 0ce4ff4d3a334ae70cf389e0e9095b6ea6ef7110b27d2728a32bb5a7f84ed064 |
| third-party/licenses/elkjs-LICENSE | 89591d4578fb1ebd91501312a3d25f021bd865a2e436641c1cf7b1bc7e3c1617 | 89591d4578fb1ebd91501312a3d25f021bd865a2e436641c1cf7b1bc7e3c1617 |
| third-party/licenses/three-LICENSE | 852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d | 852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d |
| unsupportedCrystalResourcePoolSolver.js | 02518d4874199178a24b43e8958e678f3bd4a2d645bd82bfa8e052446327d98b | 02518d4874199178a24b43e8958e678f3bd4a2d645bd82bfa8e052446327d98b |
| workerLifecycle.js | b71059217a3fd553800f141354ba82a8c8088c621b3a0bd3aa7dcd7033af0c26 | b71059217a3fd553800f141354ba82a8c8088c621b3a0bd3aa7dcd7033af0c26 |

HTML仅CDN地址、最小CSP和部署base不同；CSS仅字体@import不同；China多54个WOFF2和1份本地字体CSS；清单记录相应配置及哈希。结构化规范化比较确认去除这些字段后HTML一致，移除字体import后CSS一致；其他文件必须相同，出现任何未授权差异会使verify失败。
