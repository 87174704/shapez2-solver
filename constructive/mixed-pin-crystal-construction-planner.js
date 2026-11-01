import {
    Shape, ShapeOperationConfig, pushPin, rotate90CCW, rotate90CW, stack, swapHalves,
} from '../shapeOperations.js';
import {
    combineDisjoint, EMPTY_PART as EMPTY, layerCode, parseParts, partitionIntoColumns, partCode,
    rotateColumnToQuadrant, selectColumn, stackLayers,
} from '../constructiveSolverRuntime.js';
import { buildIsolatedPin } from './pin-construction-planner.js';
import {
    buildCrystalSubassembly, planCrystalSubassembly,
} from './crystal-construction-planner.js';

export const MIXED_PIN_CRYSTAL_PLANNER_VERSION = 'mixed-pin-crystal-interaction-v1';

export const MIXED_PIN_CRYSTAL_CAPABILITIES = Object.freeze([
    {
        id: 'protected-spatial-crystal-staging',
        mechanisms: ['solid protection cage', 'ordered Crystal generation', 'Cutter extraction'],
    },
    {
        id: 'crystal-to-pin-support-transition',
        mechanisms: ['Crystal-bearing suffix', 'Pin Pusher', 'support-preserving lower attachment'],
    },
    {
        id: 'mixed-half-recomposition',
        mechanisms: ['support-safe component ordering', 'Swapper recomposition', 'solid upper attachment'],
    },
]);

const emptyLayer = () => Array.from({ length: 4 }, () => EMPTY);
const isEmpty = part => part.shape === '-';

function trimLayers(layers) {
    let length = layers.length;
    while (length > 1 && layers[length - 1].every(isEmpty)) length -= 1;
    return layers.slice(0, length);
}

function codeFor(layers) {
    return trimLayers(layers).map(layerCode).join(':');
}

function maskLayers(layers, quadrants) {
    const kept = new Set(quadrants);
    return trimLayers(layers.map(layer => layer.map((part, quadrant) => kept.has(quadrant) ? part : EMPTY)));
}

function stackCodes(bottom, top, maxLayers) {
    return stack(
        Shape.fromShapeCode(bottom), Shape.fromShapeCode(top), new ShapeOperationConfig(maxLayers),
    )[0].toShapeCode();
}

function pushCode(input, maxLayers) {
    return pushPin(Shape.fromShapeCode(input), new ShapeOperationConfig(maxLayers))[0].toShapeCode();
}

function rotateCode(input, direction, turns, maxLayers) {
    let shape = Shape.fromShapeCode(input);
    const config = new ShapeOperationConfig(maxLayers);
    const operation = direction === 'CW' ? rotate90CW : rotate90CCW;
    for (let turn = 0; turn < turns; turn++) shape = operation(shape, config)[0];
    return shape.toShapeCode();
}

function isDenseInScope(layers, quadrants) {
    return layers.every(layer => quadrants.every(quadrant => !isEmpty(layer[quadrant])));
}

function layerCrystalColors(layers, quadrants) {
    return layers.map(layer => [...new Set(quadrants
        .map(quadrant => layer[quadrant])
        .filter(part => part.shape === 'c')
        .map(part => part.color))]);
}

function directCrystalPlan(target, layers, quadrants, maxLayers) {
    if (!layers.flat().some(part => part.shape === 'c')) return null;
    const colors = layerCrystalColors(layers, quadrants);
    if (isDenseInScope(layers, quadrants) && colors.every(row => row.length <= 1)) {
        return {
            kind: 'protected-spatial-crystal-staging',
            target,
            quadrants,
            stages: layers.map((layer, index) => ({
                layer: index,
                color: colors[index][0] ?? null,
                target: layerCode(layer),
            })),
        };
    }
    try {
        const delegated = planCrystalSubassembly(target, maxLayers);
        return { kind: 'delegated-crystal-component', target, quadrants, delegated };
    } catch {
        // The protected fallback below is intentionally narrower than the
        // generic Crystal planner: every retained cell must be occupied.
    }
    return null;
}

function planNoPinComponent(layers, quadrants, maxLayers) {
    const target = codeFor(layers);
    if (layers.flat().some(part => part.shape === 'P')) return null;
    const crystal = directCrystalPlan(target, layers, quadrants, maxLayers);
    if (crystal) return crystal;
    if (layers.flat().some(part => part.shape === 'c')) return null;
    return { kind: 'solid-component', target, quadrants, layers };
}

function columnLayers(layers, quadrant) {
    const result = [];
    for (const layer of layers) {
        const part = layer[quadrant];
        if (isEmpty(part)) {
            if (result.length && layers.slice(result.length + 1).some(candidate => !isEmpty(candidate[quadrant]))) return null;
            continue;
        }
        result.push(Array.from({ length: 4 }, (_, index) => index === quadrant ? part : EMPTY));
    }
    return result.length ? result : null;
}

function planColumn(layers, quadrant, maxLayers) {
    const target = codeFor(layers);
    const parts = layers.map(layer => layer[quadrant]);
    if (parts.some(isEmpty)) return null;
    const direct = planNoPinComponent(layers, [quadrant], maxLayers);
    if (direct) return direct;

    const firstPin = parts.findIndex(part => part.shape === 'P');
    if (firstPin < 0) return null;
    let afterPins = firstPin;
    while (afterPins < parts.length && parts[afterPins].shape === 'P') afterPins += 1;
    const lowerLayers = layers.slice(0, firstPin);
    const upperLayers = layers.slice(afterPins);
    const lower = lowerLayers.length ? planNoPinComponent(lowerLayers, [quadrant], maxLayers) : null;
    if (lowerLayers.length && !lower) return null;
    const upper = upperLayers.length ? planColumn(upperLayers, quadrant, maxLayers) : null;
    if (upperLayers.length && !upper) return null;

    let pinnedCode;
    if (upper) {
        pinnedCode = upper.target;
        for (let index = firstPin; index < afterPins; index++) pinnedCode = pushCode(pinnedCode, maxLayers);
    } else {
        pinnedCode = Array.from({ length: afterPins - firstPin }, () => (
            Array.from({ length: 4 }, (_, index) => index === quadrant ? 'P-' : '--').join('')
        )).join(':');
    }
    const result = lower ? stackCodes(lower.target, pinnedCode, maxLayers) : pinnedCode;
    if (result !== target) return null;
    return {
        kind: 'crystal-pin-column-transition', target, quadrants: [quadrant],
        quadrant, lower, upper, pinRunLength: afterPins - firstPin,
    };
}

function planHalf(layers, quadrants, maxLayers) {
    const target = codeFor(layers);
    const direct = planNoPinComponent(layers, quadrants, maxLayers);
    if (direct) return direct;

    if (layers.length > 1 && quadrants.every(quadrant => (
        layers[0][quadrant].shape === 'P' || layers[0][quadrant].shape === '-'
    ))) {
        const upperLayers = maskLayers(layers.slice(1), quadrants);
        const upper = planHalf(upperLayers, quadrants, maxLayers);
        if (upper && pushCode(upper.target, maxLayers) === target) {
            return {
                kind: 'crystal-to-pin-support-transition', target, quadrants,
                upper, operation: 'Pin Pusher',
            };
        }
    }

    for (let splitLayer = 1; splitLayer < layers.length; splitLayer++) {
        const baseLayers = maskLayers(layers.slice(0, splitLayer), quadrants);
        const upperLayers = maskLayers(layers.slice(splitLayer), quadrants);
        if (baseLayers.flat().some(part => part.shape === 'P')) continue;
        const base = planNoPinComponent(baseLayers, quadrants, maxLayers);
        const upper = planHalf(upperLayers, quadrants, maxLayers);
        if (!base || !upper || stackCodes(base.target, upper.target, maxLayers) !== target) continue;
        return {
            kind: 'mixed-base-upper-transition', target, quadrants,
            splitLayer, base, upper, operation: 'Stacker',
        };
    }

    const columns = quadrants.map(quadrant => {
        const component = columnLayers(layers, quadrant);
        return component ? planColumn(component, quadrant, maxLayers) : null;
    }).filter(Boolean);
    if (!columns.length) return null;
    const orderings = columns.length === 2 ? [columns, [columns[1], columns[0]]] : [columns];
    for (const ordered of orderings) {
        let result = ordered[0].target;
        for (const column of ordered.slice(1)) result = stackCodes(result, column.target, maxLayers);
        if (result === target) {
            return {
                kind: 'support-safe-column-composition', target, quadrants,
                columns: ordered, operation: 'Stacker',
            };
        }
    }
    if (columns.length === 2) {
        const leftHalf = quadrants[0] === 0;
        const direction = leftHalf ? 'CW' : 'CCW';
        const inverseDirection = leftHalf ? 'CCW' : 'CW';
        const routed = columns.map(column => rotateCode(column.target, direction, 1, maxLayers));
        const middle = swapHalves(
            Shape.fromShapeCode(routed[0]), Shape.fromShapeCode(routed[1]),
            new ShapeOperationConfig(maxLayers),
        ).map(shape => shape.toShapeCode()).find(code => (
            parseParts(code).flat().filter(part => !isEmpty(part)).length
            === layers.flat().filter(part => !isEmpty(part)).length
        ));
        if (middle && rotateCode(middle, inverseDirection, 1, maxLayers) === target) {
            return {
                kind: 'quarter-column-recomposition', target, quadrants, columns,
                routeDirection: direction, inverseDirection, operation: 'Swapper',
            };
        }
    }
    return null;
}

function solidUpperPlan(layers, maxLayers) {
    if (!layers.length || layers.flat().some(part => ['P', 'c'].includes(part.shape))) return null;
    const target = codeFor(layers);
    let result = layerCode(layers[0]);
    for (const layer of layers.slice(1)) result = stackCodes(result, layerCode(layer), maxLayers);
    return result === target ? { kind: 'solid-upper-component', target, layers } : null;
}

function swapResult(left, right, expected, maxLayers) {
    return swapHalves(
        Shape.fromShapeCode(left), Shape.fromShapeCode(right), new ShapeOperationConfig(maxLayers),
    ).map(shape => shape.toShapeCode()).includes(expected);
}

export function planMixedPinCrystalSubassembly(target, maxLayers = 4) {
    const sourceLayers = parseParts(target);
    if (!sourceLayers.flat().some(part => part.shape === 'P') || !sourceLayers.flat().some(part => part.shape === 'c')) {
        throw new Error('Mixed Pin/Crystal planner requires both Pin and Crystal target cells');
    }
    const candidates = [];
    let workingShape = Shape.fromShapeCode(target);
    const config = new ShapeOperationConfig(maxLayers);
    for (let rotationTurns = 0; rotationTurns < 4; rotationTurns++) {
        const workingTarget = workingShape.toShapeCode();
        const layers = parseParts(workingTarget);
        for (let splitLayer = layers.length; splitLayer >= 1; splitLayer--) {
            const lowerLayers = layers.slice(0, splitLayer);
            const lowerTarget = codeFor(lowerLayers);
            const left = planHalf(maskLayers(lowerLayers, [0, 1]), [0, 1], maxLayers);
            const right = planHalf(maskLayers(lowerLayers, [2, 3]), [2, 3], maxLayers);
            if (!left || !right || !swapResult(left.target, right.target, lowerTarget, maxLayers)) continue;
            const upper = splitLayer < layers.length ? solidUpperPlan(layers.slice(splitLayer), maxLayers) : null;
            if (splitLayer < layers.length && !upper) continue;
            const result = upper ? stackCodes(lowerTarget, upper.target, maxLayers) : lowerTarget;
            if (result !== workingTarget) continue;
            candidates.push({
                kind: 'mixed-pin-crystal-state-transition', target, workingTarget, rotationTurns, splitLayer,
                prerequisite: { left, right }, recomposition: 'Swapper', upper,
                ordering: ['construct-left', 'construct-right', 'Swapper', ...(upper ? ['Stacker-upper'] : []),
                    ...Array.from({ length: rotationTurns }, () => 'Rotator CCW')],
            });
        }
        workingShape = rotate90CW(workingShape, config)[0];
    }
    candidates.sort((a, b) => a.rotationTurns - b.rotationTurns || b.splitLayer - a.splitLayer);
    if (!candidates.length) {
        throw new Error('Mixed Pin/Crystal construction unsupported: no support-safe half decomposition survived canonical replay');
    }
    return candidates[0];
}

export function validateMixedPinCrystalPlan(target, plan, maxLayers = 4) {
    const errors = [];
    if (plan?.kind !== 'mixed-pin-crystal-state-transition') errors.push('not a mixed transition plan');
    if (plan?.target !== target) errors.push('mixed plan target mismatch');
    if (!plan?.prerequisite?.left || !plan?.prerequisite?.right) errors.push('both spatial prerequisites are required');
    if (!errors.length) {
        const lowerTarget = plan.workingTarget.split(':').slice(0, plan.splitLayer).join(':');
        if (!swapResult(plan.prerequisite.left.target, plan.prerequisite.right.target, lowerTarget, maxLayers)) {
            errors.push('canonical Swapper recomposition did not produce the lower target');
        } else if (plan.upper && stackCodes(lowerTarget, plan.upper.target, maxLayers) !== plan.workingTarget) {
            errors.push('canonical upper attachment did not produce the target');
        } else if (!plan.upper && lowerTarget !== plan.workingTarget) {
            errors.push('plan omits required upper state');
        } else {
            let result = Shape.fromShapeCode(plan.workingTarget);
            for (let turn = 0; turn < plan.rotationTurns; turn++) result = rotate90CCW(result, new ShapeOperationConfig(maxLayers))[0];
            if (result.toShapeCode() !== target) errors.push('final inverse rotation did not reproduce the target');
        }
    }
    return { valid: errors.length === 0, errors };
}

function buildSolid(builder, plan, buildPart) {
    return stackLayers(builder, plan.layers.map(parts => combineDisjoint(
        builder,
        parts.map((part, quadrant) => isEmpty(part) ? null : buildPart(part, quadrant)).filter(id => id !== null),
    )));
}

function buildProtectedCrystal(builder, plan, { buildPart, buildSacrificialPart }) {
    let staged = null;
    for (const targetLayer of parseParts(plan.target)) {
        const crystalColors = [...new Set(targetLayer.filter(part => part.shape === 'c').map(part => part.color))];
        const cageParts = targetLayer.map((part, quadrant) => {
            if (part.shape === 'c') return null;
            if (isEmpty(part)) return buildSacrificialPart(quadrant);
            return buildPart(part, quadrant);
        }).filter(id => id !== null);
        const cage = combineDisjoint(builder, cageParts);
        staged = staged === null ? cage : builder.operate('Stacker', [staged, cage])[0];
        if (crystalColors.length) staged = builder.operate(
            'Crystal Generator', [staged], { color: crystalColors[0] },
        )[0];
    }
    if (plan.quadrants.length === 2) {
        const outputs = builder.operate('Cutter', [staged]);
        const kept = outputs.find(id => builder.shape(id) === plan.target);
        if (kept === undefined) throw new Error(`protected half extraction did not produce ${plan.target}`);
        return kept;
    }
    const columns = partitionIntoColumns(builder, staged);
    const targetParts = parseParts(plan.target).map(layer => layer.find(part => !isEmpty(part)));
    let kept = selectColumn(builder, columns, code => parseParts(code).every((layer, index) => {
        const part = layer.find(candidate => !isEmpty(candidate));
        return part && partCode(part) === partCode(targetParts[index]);
    }), `protected Crystal component ${plan.target}`);
    kept = rotateColumnToQuadrant(builder, kept, plan.quadrants[0]);
    if (builder.shape(kept) !== plan.target) throw new Error(`protected column extraction did not produce ${plan.target}`);
    return kept;
}

function buildPlan(builder, plan, options) {
    if (plan.kind === 'solid-component' || plan.kind === 'solid-upper-component') {
        return buildSolid(builder, plan, options.buildPart);
    }
    if (plan.kind === 'delegated-crystal-component') {
        return buildCrystalSubassembly(builder, plan.target, options).resultId;
    }
    if (plan.kind === 'protected-spatial-crystal-staging') {
        return buildProtectedCrystal(builder, plan, options);
    }
    if (plan.kind === 'crystal-to-pin-support-transition') {
        return builder.operate('Pin Pusher', [buildPlan(builder, plan.upper, options)])[0];
    }
    if (plan.kind === 'crystal-pin-column-transition') {
        let pinned;
        if (plan.upper) {
            pinned = buildPlan(builder, plan.upper, options);
            for (let index = 0; index < plan.pinRunLength; index++) {
                pinned = builder.operate('Pin Pusher', [pinned])[0];
            }
        } else {
            const pins = Array.from({ length: plan.pinRunLength }, () => (
                buildIsolatedPin(builder, plan.quadrant, options.buildSacrificialPart)
            ));
            pinned = pins.length === 1 ? pins[0] : stackLayers(builder, pins);
        }
        return plan.lower
            ? builder.operate('Stacker', [buildPlan(builder, plan.lower, options), pinned])[0]
            : pinned;
    }
    if (plan.kind === 'mixed-base-upper-transition') {
        return builder.operate('Stacker', [
            buildPlan(builder, plan.base, options), buildPlan(builder, plan.upper, options),
        ])[0];
    }
    if (plan.kind === 'support-safe-column-composition') {
        const columns = plan.columns.map(column => buildPlan(builder, column, options));
        let result = columns[0];
        for (const column of columns.slice(1)) result = builder.operate('Stacker', [result, column])[0];
        return result;
    }
    if (plan.kind === 'quarter-column-recomposition') {
        const routed = plan.columns.map(column => {
            let id = buildPlan(builder, column, options);
            id = builder.operate(plan.routeDirection === 'CW' ? 'Rotator CW' : 'Rotator CCW', [id])[0];
            return id;
        });
        const expectedMiddle = rotateCode(
            plan.target, plan.routeDirection, 1, builder.config.maxShapeLayers,
        );
        const outputs = builder.operate('Swapper', routed);
        let result = outputs.find(id => builder.shape(id) === expectedMiddle);
        if (result === undefined) throw new Error(`quarter recomposition did not produce ${expectedMiddle}`);
        result = builder.operate(plan.inverseDirection === 'CW' ? 'Rotator CW' : 'Rotator CCW', [result])[0];
        return result;
    }
    throw new Error(`unknown mixed plan node ${plan.kind}`);
}

export function buildMixedPinCrystalSubassembly(builder, target, options) {
    const plan = planMixedPinCrystalSubassembly(target, builder.config.maxShapeLayers);
    const left = buildPlan(builder, plan.prerequisite.left, options);
    const right = buildPlan(builder, plan.prerequisite.right, options);
    const recomposed = builder.operate('Swapper', [left, right]);
    const lowerTarget = plan.workingTarget.split(':').slice(0, plan.splitLayer).join(':');
    let resultId = recomposed.find(id => builder.shape(id) === lowerTarget);
    if (resultId === undefined) throw new Error(`mixed Swapper recomposition did not produce ${lowerTarget}`);
    if (plan.upper) resultId = builder.operate('Stacker', [resultId, buildPlan(builder, plan.upper, options)])[0];
    for (let turn = 0; turn < plan.rotationTurns; turn++) resultId = builder.operate('Rotator CCW', [resultId])[0];
    if (builder.shape(resultId) !== target) {
        throw new Error(`mixed construction result ${builder.shape(resultId)} != ${target}`);
    }
    return { resultId, plan };
}

