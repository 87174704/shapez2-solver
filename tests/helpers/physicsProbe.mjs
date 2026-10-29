// Test-only in-memory observation. Production source receives no diagnostic hooks.
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
export async function probe(root = fileURLToPath(new URL('../..', import.meta.url))) {
    let source = (await fs.readFile(root + '/shapeOperations.js', 'utf8')).replaceAll('\r\n', '\n');
    source = source.replace("'./shapeConstants.js'", JSON.stringify(pathToFileURL(root + '/shapeConstants.js').href));
    const anchors = {
        '    // Collect complete crystal components before mutating their connectivity.': "globalThis.__physicsProbe?.('first', layers, supportedPartStates);",
        '    // second pass of calculating supported parts': "globalThis.__physicsProbe?.('deleted', layers);",
        '    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {\n        const layer = layers[layerIndex];': "globalThis.__physicsProbe?.('second', layers, supportedPartStates);",
    };
    for (const [anchor, hook] of Object.entries(anchors)) {
        if (source.split(anchor).length !== 2) throw Error('ambiguous probe anchor');
        source = source.replace(anchor, hook + '\n' + anchor);
    }
    source += '\nexport {_makeLayersFall, _breakCrystals};';
    return { source, module: await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')) };
}
