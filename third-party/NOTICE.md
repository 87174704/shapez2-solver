# Third-party resources

The application versions and classic/UMD entry points are inherited unchanged from RC ec9cc5cb633d021b6af276565223a392f8329b87. `tools/static-build/resources.lock.json` records exact sources, versions, SHA-256 and SHA-384 SRI. Scripts are requested from the configured public CDN, not bundled into this distribution. No runtime npm/CommonJS resolver is added.

| Resource | Version | License | Upstream source |
| --- | --- | --- | --- |
| Cytoscape.js | 3.29.2 | MIT | https://github.com/cytoscape/cytoscape.js/tree/v3.29.2 |
| ELK.js | 0.9.3 | EPL-2.0 | https://github.com/kieler/elkjs/tree/0.9.3 |
| cytoscape-elk | 2.3.0 | MIT | https://github.com/cytoscape/cytoscape.js-elk |
| three.js | 0.159.0 | MIT | https://github.com/mrdoob/three.js/tree/r159 |
| 3d-force-graph | 1.74.7 | MIT and retained bundled notices | https://github.com/vasturiano/3d-force-graph/tree/v1.74.7 |
| Barlow | Google Fonts distribution v13, original regular/italic 100–900 | SIL OFL 1.1 | https://github.com/jpt/barlow |

The copied upstream script licenses are in `licenses/`. EPL source remains available from the upstream ELK.js release and its versioned npm source archive: https://registry.npmjs.org/elkjs/-/elkjs-0.9.3.tgz . No ELK modifications are made. Bundled code and license notices in remotely requested files are preserved byte-for-byte.

The China distribution includes unmodified Google Fonts Barlow WOFF2 files and a local URL stylesheet. `barlow/OFL.txt` contains the copyright and complete OFL license. Font files are not sold separately or renamed internally. Google Fonts licensing source is pinned to commit 6cdf01867df0813c2390f90dff7dc66c87f14cf7. Global keeps the original Google Fonts CSS endpoint; its response may vary with user agent and time.

The CDN providers are delivery services, not the authors or licensors. Current-host byte verification does not establish a provider SLA, permanent availability, or reachability from every mainland ISP.
