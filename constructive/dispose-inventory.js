import { Shape, ShapeOperationConfig, halfCut, rotate180, rotate90CW, rotate90CCW } from '../shapeOperations.js';

const ERASER_OPERATIONS = {
    'Half Destroyer': halfCut, 'Rotator 180': rotate180,
    'Rotator CW': rotate90CW, 'Rotator CCW': rotate90CCW,
};

// Input inventory must come from exact finite-token replay of prefix. The caller
// replays the combined plan under the original request before accepting it.
// Four cells only: H leaves cells 0/1; a real half turn moves them to 2/3;
// another H removes them. Gravity and crystal shattering cannot add columns.
// At most 3 (180) or 4 (two quarter turns) operations per non-protected token.
export function disposeInventory(instance, prefix, inventory, targetId,
    { maxOperations = 256, expired = () => false } = {}) {
    const reject = reason => ({ valid: false, reason, steps: null });
    const live = new Map(inventory.map(token => [token.id, token.shape]));
    if (live.size !== inventory.length || live.get(targetId) !== instance.targetShapeCodes[0]) {
        return reject('target-identity');
    }
    const ids = [...instance.startingShapeCodes.keys(), ...prefix.flatMap(step => step.outputs.map(token => token.id))];
    let nextId = Math.max(-1, ...ids) + 1;
    const steps = [], config = new ShapeOperationConfig(instance.maxLayers);
    const turns = instance.enabledOperations.includes('Rotator 180') ? ['Rotator 180']
        : instance.enabledOperations.includes('Rotator CW') ? ['Rotator CW', 'Rotator CW']
        : instance.enabledOperations.includes('Rotator CCW') ? ['Rotator CCW', 'Rotator CCW'] : [];
    function operate(operation, id) {
        if (expired()) throw Error('budget');
        if (prefix.length + steps.length >= maxOperations) throw Error('operation-budget');
        if (!instance.enabledOperations.includes(operation)) throw Error('missing-half-destroyer');
        if (id === targetId || !live.has(id)) throw Error('input-identity');
        const shape = live.get(id), parsed = Shape.fromShapeCode(shape);
        if (parsed.numParts !== 4 || parsed.numLayers > instance.maxLayers) throw Error('unsupported-shape');
        const outputs = ERASER_OPERATIONS[operation](parsed, config).filter(output => !output.isEmpty())
            .map(output => ({ id: nextId++, shape: output.toShapeCode() }));
        steps.push({ operation, inputs: [{ id, shape }], outputs, params: {} });
        live.delete(id);
        for (const output of outputs) live.set(output.id, output.shape);
        return outputs;
    }
    try {
        for (const token of inventory) {
            if (token.id === targetId) continue;
            let outputs = operate('Half Destroyer', token.id);
            if (!outputs.length) continue;
            if (!turns.length) return reject('missing-half-turn');
            for (const turn of turns) outputs = operate(turn, outputs[0].id);
            outputs = operate('Half Destroyer', outputs[0].id);
            if (outputs.length) return reject('not-erased');
        }
        if (expired()) return reject('budget');
        if (live.size !== 1 || live.get(targetId) !== instance.targetShapeCodes[0]) return reject('terminal-inventory');
        return { valid: true, reason: null, steps };
    } catch (error) {
        return reject(error.message);
    }
}
