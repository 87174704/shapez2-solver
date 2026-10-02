import {
    Shape, ShapeOperationConfig, cut, halfCut, rotate90CW, rotate90CCW, rotate180,
    swapHalves, stack, topPaint, pushPin, genCrystal,
} from '../../shapeOperations.js';
import { canonicalMultiset, compileCatalog, parseParts } from './benchmark-core.mjs';

export const GENERATION_FRAMEWORK_VERSION = 'multi-strategy-v2';

const OPERATION_IMPL = Object.freeze({
    'Rotator CW': (inputs, params, config) => rotate90CW(inputs[0], config),
    'Rotator CCW': (inputs, params, config) => rotate90CCW(inputs[0], config),
    'Rotator 180': (inputs, params, config) => rotate180(inputs[0], config),
    'Half Destroyer': (inputs, params, config) => halfCut(inputs[0], config),
    Cutter: (inputs, params, config) => cut(inputs[0], config),
    Swapper: (inputs, params, config) => swapHalves(inputs[0], inputs[1], config),
    Stacker: (inputs, params, config) => stack(inputs[0], inputs[1], config),
    Painter: (inputs, params, config) => topPaint(inputs[0], params.color, config),
    'Pin Pusher': (inputs, params, config) => pushPin(inputs[0], config),
    'Crystal Generator': (inputs, params, config) => genCrystal(inputs[0], params.color, config),
});

export const STRATEGY_CAPABILITIES = Object.freeze([
    { id: 'catalog-chunk', status: 'implemented', mechanisms: ['partial inputs', 'half inputs', 'whole-chunk paint/rotate'] },
    { id: 'shared-occurrence-extraction', status: 'implemented', mechanisms: ['Cutter byproduct reuse', 'shared input occurrence reuse'] },
    { id: 'pin-subassembly', status: 'implemented', mechanisms: ['full and partial Pin masks below an upper subassembly'] },
    { id: 'crystal-scaffold-extraction', status: 'implemented', mechanisms: ['non-uniform Crystal occupancy', 'multi-stage generate/cut/stack'] },
    { id: 'legal-crystal-breakage', status: 'implemented', mechanisms: ['canonical Cutter/Swapper breakage paths'], corpusUse: 'opt-in; not needed by coverage pilot' },
    { id: 'swapper-composition', status: 'implemented', mechanisms: ['two-input/two-output composition and byproduct tracking'], corpusUse: 'interface smoke-tested' },
    { id: 'splitter-throughput', status: 'disabled-pending-semantics', mechanisms: ['Splitter'], reason: 'Success throughput is unresolved; no 2048/4096 assumption is permitted.' },
    { id: 'upper-isolated-pin', status: 'unsupported', mechanisms: ['upper/isolated Pin'], reason: 'No general constructive planner has yet been proved for arbitrary official targets.' },
    { id: 'mixed-pin-crystal-gravity', status: 'implemented', mechanisms: ['protected Crystal staging', 'Crystal-to-Pin support transition', 'support-safe Swapper recomposition'] },
]);

export class WitnessBuilder {
    constructor(maxLayers = 4) {
        this.config = new ShapeOperationConfig(maxLayers);
        this.initial = [];
        this.steps = [];
        this.live = new Map();
        this.nextId = 0;
    }

    input(shape) {
        const id = this.nextId++;
        this.initial.push({ id, shape });
        this.live.set(id, shape);
        return id;
    }

    shape(id) {
        const shape = this.live.get(id);
        if (!shape) throw new Error(`token ${id} is not live`);
        return shape;
    }

    operate(operation, inputIds, params = {}) {
        if (operation === 'Splitter') throw new Error('Splitter interface is disabled pending throughput success semantics');
        const implementation = OPERATION_IMPL[operation];
        if (!implementation) throw new Error(`generation operation unsupported: ${operation}`);
        const inputs = inputIds.map(id => Shape.fromShapeCode(this.shape(id)));
        const shapes = implementation(inputs, params, this.config);
        const outputs = shapes.filter(shape => !shape.isEmpty()).map(shape => ({ id: this.nextId++, shape: shape.toShapeCode() }));
        for (const id of inputIds) this.live.delete(id);
        for (const output of outputs) this.live.set(output.id, output.shape);
        this.steps.push({ operation, inputs: inputIds, outputs, params });
        return outputs.map(output => output.id);
    }

    rotateTo(id, expected) {
        for (let turns = 0; turns < 4; turns++) {
            if (this.shape(id) === expected) return id;
            id = this.operate('Rotator CW', [id])[0];
        }
        throw new Error(`cannot rotate ${this.shape(id)} to ${expected}`);
    }

    witness(resultId) {
        return { initial: this.initial, steps: this.steps, resultId };
    }
}

function occupiedCount(shapeCode) {
    return parseParts(shapeCode).flat().filter(part => part.shape !== '-').length;
}

/** Partition a non-crystal shape into spatial columns while preserving every
 * non-empty Cutter output.  Returning all leaves makes occurrence/byproduct reuse
 * explicit instead of silently manufacturing one token per target atom. */
export function partitionIntoColumns(builder, tokenId) {
    const pending = [tokenId];
    const result = [];
    while (pending.length) {
        let current = pending.pop();
        const occupiedQuadrants = new Set(parseParts(builder.shape(current)).flatMap(layer => layer
            .map((part, quadrant) => part.shape === '-' ? null : quadrant).filter(value => value !== null)));
        if (occupiedQuadrants.size <= 1) { result.push(current); continue; }
        let split = null;
        for (let turns = 0; turns < 4 && !split; turns++) {
            const preview = cut(Shape.fromShapeCode(builder.shape(current)), builder.config)
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            if (preview.length === 2 && preview.reduce((sum, code) => sum + occupiedCount(code), 0) === occupiedCount(builder.shape(current))) {
                split = builder.operate('Cutter', [current]);
                break;
            }
            current = builder.operate('Rotator CW', [current])[0];
        }
        if (!split) throw new Error(`cannot losslessly partition ${builder.shape(current)} into columns`);
        pending.push(...split);
    }
    return result;
}

export function selectColumn(builder, ids, predicate, context) {
    const index = ids.findIndex(id => predicate(builder.shape(id)));
    if (index < 0) throw new Error(`missing column for ${context}`);
    return ids.splice(index, 1)[0];
}

export function rotateColumnToQuadrant(builder, id, quadrant) {
    const layers = parseParts(builder.shape(id));
    const current = layers[0].findIndex(part => part.shape !== '-');
    if (current < 0 || layers.some(layer => layer.findIndex(part => part.shape !== '-') !== current)) {
        throw new Error('expected a single spatial column');
    }
    const turns = (quadrant - current + 4) % 4;
    for (let i = 0; i < turns; i++) id = builder.operate('Rotator CW', [id])[0];
    return id;
}

export function combineDisjoint(builder, ids) {
    if (!ids.length) throw new Error('cannot combine an empty component list');
    let result = ids[0];
    for (let index = 1; index < ids.length; index++) result = builder.operate('Stacker', [result, ids[index]])[0];
    return result;
}

export function stackLayers(builder, ids) {
    if (!ids.length) throw new Error('cannot stack an empty layer list');
    let result = ids[0];
    for (let index = 1; index < ids.length; index++) result = builder.operate('Stacker', [result, ids[index]])[0];
    return result;
}

export function consolidateAvailableInputs(initial, requiredBundle = []) {
    const counts = new Map();
    for (const token of initial) counts.set(token.shape, (counts.get(token.shape) ?? 0) + 1);
    for (const input of requiredBundle) counts.set(input.shape, Math.max(counts.get(input.shape) ?? 0, input.count));
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([shape, count]) => ({ shape, count }));
}

export class OrdinaryAtomAllocator {
    constructor(builder, catalog, { track, refinementGroup = null } = {}) {
        this.builder = builder;
        this.compiled = compileCatalog(catalog);
        this.track = track;
        this.refinementGroup = refinementGroup;
        this.counts = new Map();
    }

    sourceFor(type) {
        const candidates = [...this.compiled.ordinary].filter(([shape, category]) => category !== 'pure'
            && !(shape === 'SuSuRuRu' && (this.track === 'main' || this.refinementGroup))
            && parseParts(shape)[0].some(part => part.shape === type)
            && (this.counts.get(shape) ?? 0) < 3);
        if (!candidates.length) throw new Error(`no ordinary source available for ${type}`);
        candidates.sort((a, b) => (this.counts.get(a[0]) ?? 0) - (this.counts.get(b[0]) ?? 0) || a[0].localeCompare(b[0]));
        const shape = candidates[0][0];
        this.counts.set(shape, (this.counts.get(shape) ?? 0) + 1);
        return shape;
    }

    atom(part, quadrant) {
        const source = this.sourceFor(part.shape);
        const columns = partitionIntoColumns(this.builder, this.builder.input(source));
        let id = selectColumn(this.builder, columns, code => parseParts(code).flat().some(candidate => candidate.shape === part.shape), part.shape);
        id = rotateColumnToQuadrant(this.builder, id, quadrant);
        if (part.color !== 'u') id = this.builder.operate('Painter', [id], { color: part.color })[0];
        const expected = Array.from({ length: 4 }, (_, index) => index === quadrant ? `${part.shape}${part.color}` : '--').join('');
        if (this.builder.shape(id) !== expected) throw new Error(`atom ${this.builder.shape(id)} != ${expected}`);
        return id;
    }

    layer(layerCode) {
        const ids = parseParts(layerCode)[0].map((part, quadrant) => part.shape === '-' ? null : this.atom(part, quadrant)).filter(id => id !== null);
        const result = combineDisjoint(this.builder, ids);
        if (this.builder.shape(result) !== layerCode) throw new Error(`layer ${this.builder.shape(result)} != ${layerCode}`);
        return result;
    }
}

export function canonicalAvailableSignature(builder, requiredBundle = []) {
    return canonicalMultiset(consolidateAvailableInputs(builder.initial, requiredBundle));
}
