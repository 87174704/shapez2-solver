// Run before implementation. Uses no solver or production physics.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const file = new URL('./holdouts.json', import.meta.url);
if (fs.existsSync(file)) throw Error('Holdouts already locked');
const ops = ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter', 'Swapper', 'Stacker'];
const rows = [];
function add(id, target, sources, changes = {}, expectation = 'reachable') {
    rows.push({ id, tier: 'holdout', source: 'independent-prespecified', expectation, input: {
        targetShapeCodes: [target], startingShapeCodes: sources, enabledOperations: ops,
        maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: false,
        orientationSensitive: true, allowSplitting: false, cleanPainting: true, ...changes,
    }});
}
add('L01-mixed', 'RuCuSuWu', ['RuRuRuRu', 'CuCuCuCu', 'SuSuSuSu', 'WuWuWuWu']);
add('L02-two-layer', 'RuRu----:CuCu----', ['RuRu----', 'CuCu----']);
add('L03-three-layer', 'Su------:Ru------:Cu------', ['Su------', 'Ru------', 'Cu------']);
add('L04-four-layer', 'Wu------:Su------:Ru------:Cu------', ['Wu------', 'Su------', 'Ru------', 'Cu------']);
add('L05-clockwise', '--Ru----', ['Ru------'], { enabledOperations: ['Rotator CW'] });
add('L06-counterclockwise', '------Ru', ['Ru------'], { enabledOperations: ['Rotator CCW'] });
add('L07-halfturn', '----Su--', ['Su------'], { enabledOperations: ['Rotator 180'] });
add('L08-copies', 'Ru------:Ru------', ['Ru------', 'Ru------'], { enabledOperations: ['Stacker'] });
add('L09-surplus-copies', 'RuCuSuWu', ['RuRuRuRu', 'CuCuCuCu', 'SuSuSuSu', 'WuWuWuWu', 'RuRuRuRu', 'CuCuCuCu']);
add('L10-no-rotation-needed', 'Ru------:Cu------', ['Ru------', 'Cu------'], { enabledOperations: ['Stacker'] });
add('L11-clean-paint', 'Cr------', ['Cu------'], { enabledOperations: [...ops, 'Painter'] });
add('L12-paint-disabled', 'Cr------', ['Cu------'], {}, 'unreachable');
add('L13-insufficient-copy', 'Ru------:Ru------', ['Ru------'], { enabledOperations: ['Stacker'] }, 'unreachable');
add('L14-wrong-direction', '--Ru----', ['Ru------'], { enabledOperations: [] }, 'unreachable');
add('L15-stack-disabled', 'Ru------:Cu------', ['Ru------', 'Cu------'], { enabledOperations: ['Rotator CW'] }, 'unreachable');
add('L16-cutter-only', 'RuRu----', ['RuRuRuRu'], { enabledOperations: ['Cutter'] });
add('L17-no-cutters', 'Ru------:Su------', ['Ru------', 'Su------'], { enabledOperations: ['Stacker', 'Rotator CW'] });
add('L18-rotated-mixed', 'WuRuCuSu', ['RuRuRuRu', 'CuCuCuCu', 'SuSuSuSu', 'WuWuWuWu']);
add('L19-layer-cap-two', 'Ru------:Cu------', ['Ru------', 'Cu------'], { maxLayers: 2, enabledOperations: ['Stacker'] });
add('L20-waste-rule', 'Ru------', ['Ru------', 'Cu------'], { preventWaste: true, enabledOperations: [] }, 'unreachable');
add('L21-paint-rule-off', 'Cr------', ['Cu------'], { cleanPainting: false, enabledOperations: ['Painter'] });
add('L22-rotation-insensitive', '--Ru----', ['Ru------'], { orientationSensitive: false, enabledOperations: [] });
add('L23-multilayer-resource', 'RuRu----:CuCu----', ['RuRu----:CuCu----']);
add('L24-different-parts', 'HuFuGuRu', ['HuHuHuHu', 'FuFuFuFu', 'GuGuGuGu', 'RuRuRuRu']);
const bytes = JSON.stringify(rows, null, 2) + '\n';
fs.writeFileSync(file, bytes);
fs.writeFileSync(new URL('./holdout-lock.json', import.meta.url), JSON.stringify({
    createdBeforeImplementation: true, rc: 'ec9cc5cb633d021b6af276565223a392f8329b87',
    createdAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'),
    cases: rows.length, policy: 'All prespecified cases retained; no solver used in selection. Reachability expectations are hypotheses checked by replay, not witnesses.',
}, null, 2) + '\n');
