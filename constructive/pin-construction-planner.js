import { Shape, ShapeOperationConfig, stack } from '../shapeOperations.js';
import {
    combineDisjoint, parseParts, partitionIntoColumns, rotateColumnToQuadrant, selectColumn, stackLayers,
} from '../constructiveSolverRuntime.js';

export const PIN_CONSTRUCTION_PLANNER_VERSION = 'generic-pin-construction-v1';

export const PIN_CONSTRUCTION_CAPABILITIES = Object.freeze([
    { id: 'pin-column-sequence', mechanisms: ['mixed solid/Pin columns', 'consecutive Pins', 'top Pin via canonical overflow'] },
    { id: 'pin-supported-upper-region', mechanisms: ['Pin-bearing base columns', 'supported raised solid component'] },
    { id: 'isolated-pin-crystal-scaffold', mechanisms: ['temporary Crystal column', 'Cutter extraction', 'Pin overflow breakage', 'process-only scaffold'] },
]);

const partCode = part => `${part.shape}${part.color}`;
const layerCode = parts => parts.map(partCode).join('');
const emptyPart = () => ({ shape: '-', color: '-' });

function columnCode(parts, quadrant) {
    return parts.map(part => Array.from({ length: 4 }, (_, index) => index === quadrant ? partCode(part) : '--').join('')).join(':');
}

function trimUpperEmpty(parts) {
    let length = parts.length;
    while (length && parts[length - 1].shape === '-') length -= 1;
    return parts.slice(0, length);
}

function constructibleColumn(parts) {
    const trimmed = trimUpperEmpty(parts);
    if (!trimmed.length) return true;
    return trimmed[0].shape !== '-' && !trimmed.some(part => part.shape === '-' || part.shape === 'c');
}

function stackCodes(bottom, top, maxLayers) {
    if (!bottom) return top;
    if (!top) return bottom;
    return stack(Shape.fromShapeCode(bottom), Shape.fromShapeCode(top), new ShapeOperationConfig(maxLayers))[0].toShapeCode();
}

function planBaseColumns(layers, upperQuadrants, splitLayer, maxLayers) {
    const columns = [];
    for (let quadrant = 0; quadrant < 4; quadrant++) {
        const end = upperQuadrants.has(quadrant) ? splitLayer : layers.length;
        const parts = trimUpperEmpty(layers.slice(0, end).map(layer => layer[quadrant]));
        if (!constructibleColumn(parts)) return null;
        if (parts.length) columns.push({ quadrant, parts, shape: columnCode(parts, quadrant) });
    }
    let shape = null;
    for (const column of columns) shape = stackCodes(shape, column.shape, maxLayers);
    return { columns, shape };
}

function planSolidUpper(layers, quadrants, splitLayer, maxLayers) {
    const shiftedLayers = layers.slice(splitLayer).map(layer => layer.map((part, quadrant) => quadrants.has(quadrant) ? part : emptyPart()));
    if (shiftedLayers.some(layer => layer.every(part => part.shape === '-'))) return null;
    if (shiftedLayers.flat().some(part => ['P', 'c'].includes(part.shape))) return null;
    const codes = shiftedLayers.map(layerCode);
    let shape = null;
    for (const code of codes) shape = stackCodes(shape, code, maxLayers);
    if (shape !== codes.join(':')) return null;
    return { layers: shiftedLayers, shape };
}

/** Plans only candidates whose composition reproduces the target under the canonical Stacker. */
export function planPinSubassembly(target, maxLayers = 4) {
    const layers = parseParts(target);
    if (!layers.flat().some(part => part.shape === 'P')) throw new Error('Pin construction planner requires a Pin target');
    if (layers.flat().some(part => part.shape === 'c')) throw new Error('Pin construction planner does not claim mixed Pin/Crystal targets');

    const direct = planBaseColumns(layers, new Set(), layers.length, maxLayers);
    if (direct?.shape === target) return { kind: 'pin-column-sequence', ...direct, upper: null };

    const candidates = [];
    for (let splitLayer = 1; splitLayer < layers.length; splitLayer++) {
        for (let mask = 1; mask < 16; mask++) {
            const quadrants = new Set(Array.from({ length: 4 }, (_, quadrant) => quadrant).filter(quadrant => mask & (1 << quadrant)));
            const base = planBaseColumns(layers, quadrants, splitLayer, maxLayers);
            if (!base?.shape) continue;
            const upper = planSolidUpper(layers, quadrants, splitLayer, maxLayers);
            if (!upper || stackCodes(base.shape, upper.shape, maxLayers) !== target) continue;
            const upperPartCount = upper.layers.flat().filter(part => part.shape !== '-').length;
            candidates.push({ kind: 'pin-supported-upper-region', ...base, upper, splitLayer, upperQuadrants: [...quadrants], upperPartCount });
        }
    }
    candidates.sort((a, b) => a.upperPartCount - b.upperPartCount || b.splitLayer - a.splitLayer
        || a.upperQuadrants.join('').localeCompare(b.upperQuadrants.join('')));
    if (candidates.length) return candidates[0];
    throw new Error('Pin construction unsupported: no canonical column/support-region composition matched the target');
}

export function buildIsolatedPin(builder, quadrant, buildSacrificialPart, color = 'r') {
    const scaffoldLayers = Array.from({ length: builder.config.maxShapeLayers }, () => combineDisjoint(
        builder,
        Array.from({ length: 4 }, (_, candidate) => candidate === quadrant ? null : buildSacrificialPart(candidate)).filter(id => id !== null),
    ));
    let scaffold = stackLayers(builder, scaffoldLayers);
    scaffold = builder.operate('Crystal Generator', [scaffold], { color })[0];
    const columns = partitionIntoColumns(builder, scaffold);
    let crystal = selectColumn(builder, columns, code => parseParts(code).every(layer => (
        layer.filter(part => part.shape === 'c').length === 1 && layer.filter(part => part.shape !== '-').length === 1
    )), `isolated Crystal scaffold in quadrant ${quadrant}`);
    crystal = rotateColumnToQuadrant(builder, crystal, quadrant);
    const pin = builder.operate('Pin Pusher', [crystal])[0];
    const expected = Array.from({ length: 4 }, (_, candidate) => candidate === quadrant ? 'P-' : '--').join('');
    if (builder.shape(pin) !== expected) throw new Error(`isolated Pin construction ${builder.shape(pin)} != ${expected}`);
    return pin;
}

function buildPinColumn(builder, parts, quadrant, buildPart, buildSacrificialPart, useOverflowScaffold) {
    const firstPin = parts.findIndex(part => part.shape === 'P');
    if (firstPin < 0) return stackLayers(builder, parts.map(part => buildPart(part, quadrant)));
    let afterPins = firstPin;
    while (afterPins < parts.length && parts[afterPins].shape === 'P') afterPins += 1;
    const lower = parts.slice(0, firstPin);
    const upper = parts.slice(afterPins);
    let pinnedUpper;
    if (upper.length) {
        pinnedUpper = buildPinColumn(builder, upper, quadrant, buildPart, buildSacrificialPart, useOverflowScaffold);
        for (let index = firstPin; index < afterPins; index++) pinnedUpper = builder.operate('Pin Pusher', [pinnedUpper])[0];
    } else if (useOverflowScaffold) {
        pinnedUpper = buildSacrificialPart(quadrant);
        for (let index = firstPin; index < afterPins; index++) pinnedUpper = builder.operate('Pin Pusher', [pinnedUpper])[0];
    } else {
        pinnedUpper = stackLayers(builder, Array.from(
            { length: afterPins - firstPin }, () => buildIsolatedPin(builder, quadrant, buildSacrificialPart),
        ));
    }
    if (!lower.length) return pinnedUpper;
    const lowerId = stackLayers(builder, lower.map(part => buildPart(part, quadrant)));
    return builder.operate('Stacker', [lowerId, pinnedUpper])[0];
}

export function buildPinSubassembly(builder, target, { buildPart, buildSacrificialPart }) {
    const plan = planPinSubassembly(target, builder.config.maxShapeLayers);
    const columnIds = plan.columns.map(column => {
        const id = buildPinColumn(builder, column.parts, column.quadrant, buildPart, buildSacrificialPart,
            column.parts.length === builder.config.maxShapeLayers);
        if (builder.shape(id) !== column.shape) throw new Error(`Pin column construction ${builder.shape(id)} != ${column.shape}`);
        return id;
    });
    let resultId = combineDisjoint(builder, columnIds);
    if (plan.upper) {
        const upperId = stackLayers(builder, plan.upper.layers.map(parts => combineDisjoint(
            builder,
            parts.map((part, quadrant) => part.shape === '-' ? null : buildPart(part, quadrant)).filter(id => id !== null),
        )));
        if (builder.shape(upperId) !== plan.upper.shape) throw new Error(`supported upper construction ${builder.shape(upperId)} != ${plan.upper.shape}`);
        resultId = builder.operate('Stacker', [resultId, upperId])[0];
    }
    if (builder.shape(resultId) !== target) throw new Error(`Pin construction result ${builder.shape(resultId)} != ${target}`);
    return { resultId, plan };
}

