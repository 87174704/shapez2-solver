export const RC_COMMIT = 'ec9cc5cb633d021b6af276565223a392f8329b87';
export const RC_TREE = '4e49a58cd2d89923ebea189ffbfc9ab9b1049d87';
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap';
export const dependencies = [
  { name: 'cytoscape', version: '3.29.2', file: 'dist/cytoscape.min.js', global: 'https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js', license: 'MIT', licenseFile: 'LICENSE' },
  { name: 'elkjs', version: '0.9.3', file: 'lib/elk.bundled.js', global: 'https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js', license: 'EPL-2.0', licenseFile: 'LICENSE.md' },
  { name: 'cytoscape-elk', version: '2.3.0', file: 'dist/cytoscape-elk.min.js', global: 'https://cdn.jsdelivr.net/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js', license: 'MIT', licenseFile: 'LICENSE' },
  { name: 'three', version: '0.159.0', file: 'build/three.min.js', global: 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js', license: 'MIT', licenseFile: 'LICENSE' },
  { name: '3d-force-graph', version: '1.74.7', file: 'dist/3d-force-graph.min.js', global: 'https://cdn.jsdelivr.net/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js', license: 'MIT (bundled notices retained)', licenseFile: 'LICENSE' },
].map(d => ({ ...d, china: `https://jsdelivr.topthink.com/npm/${d.name}@${d.version}/${d.file}` }));
export const profiles = {
  global: { basePath: '/shapez2-solver/', scriptOrigins: ['https://unpkg.com', 'https://cdn.jsdelivr.net'], fontCss: FONT_CSS, fontOrigins: ['https://fonts.gstatic.com'], styleOrigins: ['https://fonts.googleapis.com'] },
  china: { basePath: '/', scriptOrigins: ['https://jsdelivr.topthink.com'], fontCss: './assets/fonts/barlow.css', fontOrigins: [], styleOrigins: [] },
};
