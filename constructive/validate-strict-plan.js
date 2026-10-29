import { Shape, ShapeOperationConfig } from '../shapeOperations.js';
import { COLOR_CODES, UNPAINTABLE_PARTS, UNCOLORED_CODE } from '../shapeConstants.js';

const COLORS = new Set(Object.values(COLOR_CODES));

// Deliberately narrow: one exact goal, whole finite tokens, no splitting.
// Re-executes Physics v2, without importing the Node test oracle.
export function validateStrictPlan(instance, path, operations, expired = () => false) {
    const reject = reason => ({ valid: false, reason });
    if (instance.orientationSensitive !== true || instance.allowSplitting !== false
        || instance.targetShapeCodes.length !== 1 || !Array.isArray(path) || path.length > 256) {
        return reject('unsupported-plan');
    }
    const live = new Map(instance.startingShapeCodes.map((shape, id) => [id, shape]));
    const used = new Set(live.keys());
    const config = new ShapeOperationConfig(instance.maxLayers);
    try {
        for (const step of path) {
            if (expired()) return reject('budget');
            const definition = Object.hasOwn(operations, step?.operation) ? operations[step.operation] : null;
            if (!definition || !instance.enabledOperations.includes(step.operation)) return reject('disabled-operation');
            if (!Array.isArray(step.inputs) || step.inputs.length !== definition.inputCount
                || !Array.isArray(step.outputs)) return reject('arity');
            const seen = new Set();
            const shapes = step.inputs.map(input => {
                if (!Number.isSafeInteger(input.id) || seen.has(input.id) || !live.has(input.id)
                    || live.get(input.id) !== input.shape) throw Error('input-inventory');
                seen.add(input.id);
                return Shape.fromShapeCode(input.shape);
            });
            const params = step.params === undefined ? {} : step.params;
            if (params === null || typeof params !== 'object' || Array.isArray(params)) return reject('params');
            const keys = Reflect.ownKeys(params);
            if (definition.needsColor) {
                if (keys.length !== 1 || keys[0] !== 'color' || !COLORS.has(params.color)) return reject('color');
            } else if (keys.length) return reject('params');
            if (step.operation === 'Painter' && instance.cleanPainting
                && (shapes[0].numLayers !== 1 || shapes[0].layers[0].some(part =>
                    !UNPAINTABLE_PARTS.includes(part.shape) && part.color !== UNCOLORED_CODE))) {
                return reject('clean-painting');
            }
            const args = definition.needsColor ? [...shapes, params.color, config] : [...shapes, config];
            const expected = definition.fn(...args).filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            const actual = step.outputs.map(output => output.shape);
            if (step.operation === 'Swapper') { expected.sort(); actual.sort(); }
            if (expected.length !== actual.length || expected.some((code, i) => code !== actual[i])) return reject('physics');
            for (const input of step.inputs) live.delete(input.id);
            for (const output of step.outputs) {
                if (!Number.isSafeInteger(output.id) || output.id < 0 || used.has(output.id)) return reject('output-id');
                used.add(output.id);
                live.set(output.id, output.shape);
            }
        }
        if (expired()) return reject('budget');
        const target = instance.targetShapeCodes[0];
        if (![...live.values()].includes(target)) return reject('exact-goal');
        if (instance.preventWaste && [...live.values()].some(code => code !== target)) return reject('waste');
        return { valid: true, reason: null };
    } catch (error) {
        return reject(error.message);
    }
}
