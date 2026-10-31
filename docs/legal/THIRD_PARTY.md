# Third-party dependencies and licenses

VERIFIED — versioned package metadata, registry integrity and original license texts were checked in Phase B; those texts are copied here without alteration. UNKNOWN remains explicit below.

| Component | Delivery | License evidence | Required action / boundary |
|---|---|---|---|
| cytoscape 3.29.2 | external CDN only | VERIFIED MIT | If vendored: preserve notices and verify every bundled component. Bundle closure UNKNOWN. |
| elkjs 0.9.3 | external CDN only | VERIFIED EPL-2.0 | If vendored: preserve notices and verify every bundled component. Bundle closure UNKNOWN. If distributing ELK: include EPL, preserve notices and state how corresponding source is obtained (https://github.com/kieler/elkjs/tree/0.9.3); audit embedded Google component separately. |
| cytoscape-elk 2.3.0 | external CDN only | VERIFIED MIT | If vendored: preserve notices and verify every bundled component. Bundle closure UNKNOWN. |
| three 0.159.0 | external CDN only | VERIFIED MIT | If vendored: preserve notices and verify every bundled component. Bundle closure UNKNOWN. |
| 3d-force-graph 1.74.7 | external CDN only | VERIFIED MIT | If vendored: preserve notices and verify every bundled component. Bundle closure UNKNOWN. |
| ajv 8.17.1 | npm lock; installed for tooling, not static deployment | VERIFIED MIT | Not in static runtime package; retain original license if distributing an installed dependency copy. |
| fast-deep-equal 3.1.3 | npm lock; installed for tooling, not static deployment | VERIFIED MIT | Not in static runtime package; retain original license if distributing an installed dependency copy. |
| fast-uri 3.1.8 | npm lock; installed for tooling, not static deployment | VERIFIED BSD-3-Clause | Not in static runtime package; retain original license if distributing an installed dependency copy. |
| json-schema-traverse 1.0.0 | npm lock; installed for tooling, not static deployment | VERIFIED MIT | Not in static runtime package; retain original license if distributing an installed dependency copy. |
| require-from-string 2.0.2 | npm lock; installed for tooling, not static deployment | VERIFIED MIT | Not in static runtime package; retain original license if distributing an installed dependency copy. |
| Barlow | External Google Fonts CSS → fonts.gstatic.com; no local font file | VERIFIED OFL-1.1 and exact copyright in licenses/Barlow-OFL-1.1.txt | Rehost only with OFL/copyright and reserved-name compliance; font byte/version not pinned: UNKNOWN |
| Loupau38 Python logic | Directly ported into shapeOperations.js | VERIFIED current repository MIT | Retain 2025 exact notice; historical source revision correspondence UNKNOWN |
| Loupau38 viewer | Directly adapted into shapeRendering.js | VERIFIED current repository MIT | Retain 2026 exact notice; historical source revision correspondence UNKNOWN |

## Embedded-component gaps

The package-level license is not a complete bundle SBOM. Do not mark the following as PASS.

- UNKNOWN: `cytoscape-elk@2.3.0 -> elkjs@^0.9.3`: declared range, not an exact embedded build identity or complete license proof.
- UNKNOWN: `3d-force-graph@1.74.7 -> three@>=0.118 <1`: declared range, not an exact embedded build identity or complete license proof.
- UNKNOWN: `3d-force-graph@1.74.7 -> kapsule@^1.16`: declared range, not an exact embedded build identity or complete license proof.
- UNKNOWN: `3d-force-graph@1.74.7 -> accessor-fn@1`: declared range, not an exact embedded build identity or complete license proof.
- UNKNOWN: `3d-force-graph@1.74.7 -> three-forcegraph@1`: declared range, not an exact embedded build identity or complete license proof.
- UNKNOWN: `3d-force-graph@1.74.7 -> three-render-objects@^1.33`: declared range, not an exact embedded build identity or complete license proof.
- VERIFIED embedded copyright leads in Cytoscape bundle: Ralf S. Engelschall (2013–2014), Gaetan Renaudeau, Koen Bok; exact component boundaries, all applicable terms and closure UNKNOWN.
- VERIFIED embedded Google LLC 2020 notice in ELK bundle; exact component/license closure UNKNOWN.
- UNKNOWN: further embedded dependencies and versions in minified bundles. Direct CDN references retained; vendoring is gated on a complete bill of materials.
- VERIFIED: npm package three includes example font licenses/notices; these example fonts are not requested by the current frontend or shipped by the proposed allowlist. Their presence in the npm archive does not license Barlow or project images.

## Per-file images

| File | SHA-256 | Rights |
|---|---|---|
| images/clipboard-copy.png | `d4a98e277b16c725ab9f2c22e9cbe3c527518ea275be904baf7348ef2da41705` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/clipboard.png | `16ebe145365c8fd552a53b82fb136ba852dbe7b901fda8ab852eb31fd2cb4e1f` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/duplicate.png | `2c4ce8d0b9d8b3ee4edcc12a33908dd62cee83eec8c57217b8d3ab923e8b462e` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/favicon.ico | `ca2b87b1af1734c821ab8477a72c89ac87bdbe46af82e9078a7d3f14f6921936` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/favicon2.ico | `a4b84576b83adfdb00c5795f3f0df878f63381524ffce4f9cb66039ee791f1cd` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/fluids.png | `7e2047f0414da651aa3eea8b03f1545bed6418d8e2060e49250224a31e4441ce` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/link.png | `15469be7881c96550fa96df9d6e1b4b3864296a4ecb3e108054a1a8d42c7bd4d` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/nodes.png | `949e33a92455dd7616d0e9e84482f53e25b38b07a70dc46918ffc1c60a80e317` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/color-mixer.png | `3cd278217db6f4107f19406aab2137e179885538684394f93fbce98491f3d87a` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/crystal-generator.png | `9d6e1c3bb7b5016241b3b34144c5153057126f3150629b6cbf31553cf4b61335` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/crystal-generator2.png | `65b92da62ee6af51e84f542d0158a797d309063dad1902a050c23752a1d4e1a8` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/cutter.png | `f119d2894f9282bc5665c49b978937db40aa2183a80ef31e4b263a11d3c881c2` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/cutter2.png | `43566c0c002d49269aecf3bfed55ab1f0df627bdbc6b87b0279fac161da8535b` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/half-destroyer.png | `1156908f3b692aa02eabedd49e1cd6dd49ee381e81ca9d4262f4267c9adae429` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/painter.png | `aa518e2dd023c12996334bd8c24591bec0bdfaa35ab26db30897745ba365bc70` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/pin-pusher.png | `cfe734e25c8e53e0e240b9d10f972cc6440d00dfc6ac79b806f72c4d9baa8cb1` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/pin-pusher2.png | `7982a8f802002d6805489dd444012370a856a2d9899a29412d770b9dd42f9045` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/rotator-180.png | `c51f96533ae4eec9a208d89cc052d4a179f8f12e7306b440f36c36f22941641a` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/rotator-ccw.png | `678b294606a9e090673bbac82a0aadf13c1298e8951f2bf5db4c9c4f96403fad` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/rotator-cw.png | `d14bda0847508b28a915cab22a179f44839c15f2a62e42048745d7c4e0f756fb` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/splitter.png | `7fd90d1d003c30e90397fa563c40c11f2052ca4ab89134a934cb65eee8ea5c24` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/stacker.png | `a38b9e57e39884f8d8d1299336a06599633bf272fe359f10e4ef6e427c2cac5c` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/operations/swapper.png | `dfd08efe3fb33c1df97609b12ded0449e7b8a9b0d2607f982ce752a2eae4eb0e` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/processor.png | `a889ec4a61729400cbd126ea23b014d74067ba6a33ce8fe2836c72a099d9f810` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/shapes.png | `915b719fab543271b9918c8576e0ba64035f04398bfc42029f43fcbe973c7b18` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/trades.png | `91d841d5f9219a76340527a66689cf8e29d7425c94d6e3dd3ca27d1423e148eb` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/trades2.png | `07dc8cb0e3a5f9d22902f299404f697d60b849d6c5b9b0e3c45701a379921d24` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |
| images/trash.png | `999f318a7c2e84fb1b3d1d0efaade4fdbd93223952efe98ccfcbe4a1a7c39690` | UNKNOWN; byte-identical in local upstream ZIP, not a rights grant |

## Benchmark

- VERIFIED: seed and USER_RULES are described as supplied by the project owner. This is provenance, not a publication license.
- UNKNOWN: rights/terms for hard_main.txt, hard_side.txt, insane_main.txt, insane_side.txt and all embedded target strings in manifests, instances, results and historical copies.
- VERIFIED: Phase C records the owner’s scoped MIT decision for original rules, generators, algorithms and documents within their authority. This is not a blanket grant for third-party targets or artwork; underlying third-party authority remains UNKNOWN. See LICENSING.md.
- INFERRED gate: retain immutable Benchmark bytes; record permission and scoped data license in new files, without editing frozen rules/manifests.


## Preserved original notices

- [3d-force-graph-1.74.7-package__LICENSE](licenses/3d-force-graph-1.74.7-package__LICENSE)
- [ajv-8.17.1-package__LICENSE](licenses/ajv-8.17.1-package__LICENSE)
- [Barlow-OFL-1.1.txt](licenses/Barlow-OFL-1.1.txt)
- [cytoscape-3.29.2-package__LICENSE](licenses/cytoscape-3.29.2-package__LICENSE)
- [cytoscape-elk-2.3.0-package__LICENSE](licenses/cytoscape-elk-2.3.0-package__LICENSE)
- [elkjs-0.9.3-package__LICENSE.md](licenses/elkjs-0.9.3-package__LICENSE.md)
- [fast-deep-equal-3.1.3-package__LICENSE](licenses/fast-deep-equal-3.1.3-package__LICENSE)
- [fast-uri-3.1.8-package__LICENSE](licenses/fast-uri-3.1.8-package__LICENSE)
- [json-schema-traverse-1.0.0-package__LICENSE](licenses/json-schema-traverse-1.0.0-package__LICENSE)
- [Loupau38-shapez2-python-MIT.txt](licenses/Loupau38-shapez2-python-MIT.txt)
- [Loupau38-viewer-MIT.txt](licenses/Loupau38-viewer-MIT.txt)
- [require-from-string-2.0.2-package__license](licenses/require-from-string-2.0.2-package__license)
- [three-0.159.0-package__examples__fonts__droid__NOTICE](licenses/three-0.159.0-package__examples__fonts__droid__NOTICE)
- [three-0.159.0-package__examples__fonts__LICENSE](licenses/three-0.159.0-package__examples__fonts__LICENSE)
- [three-0.159.0-package__LICENSE](licenses/three-0.159.0-package__LICENSE)

## Unchanged runtime delivery URLs

- `cytoscape@3.29.2`: https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js
- `elkjs@0.9.3`: https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js
- `cytoscape-elk@2.3.0`: https://cdn.jsdelivr.net/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js
- `three@0.159.0`: https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js
- `3d-force-graph@1.74.7`: https://cdn.jsdelivr.net/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js

Barlow: the Google Fonts CSS import in `styles.css` remains unchanged; no font file is vendored. Copyright 2017 The Barlow Project Authors, under OFL-1.1. The CSS response/font bytes are not pinned. For ELK.js the source corresponding to the unchanged external version is available at https://github.com/kieler/elkjs/tree/0.9.3 ; preserve its EPL text and notices when redistributing it, and provide corresponding source if the applicable terms require it for changes. Independent caller files are not automatically relicensed EPL. No ELK bundle is added to this repository.

VERIFIED — Ajv and its four locked dependencies are tooling dependencies, outside the static runtime payload. The two three.js example-font texts are preserved as package evidence; those example fonts are not used by the frontend. UNKNOWN — this inventory is not a complete embedded-component SBOM. A future CDN mirror, offline bundle or font self-hosting needs a separate review before redistribution.
