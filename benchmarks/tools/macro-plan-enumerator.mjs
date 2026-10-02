import { Shape, ShapeOperationConfig, rotate90CW } from '../../shapeOperations.js';
import { parseParts } from './benchmark-core.mjs';
import {
    OrdinaryAtomAllocator, combineDisjoint, partitionIntoColumns,
    rotateColumnToQuadrant, selectColumn, stackLayers,
} from './generation-framework.mjs';
import {
    buildIsolatedPin, buildPinSubassembly, planPinSubassembly,
} from './pin-construction-planner.mjs';
import {
    buildCrystalSubassembly, planCrystalSubassembly,
} from './crystal-construction-planner.mjs';
import {
    buildMixedPinCrystalSubassembly, planMixedPinCrystalSubassembly,
} from './mixed-pin-crystal-construction-planner.mjs';

export const MACRO_PLAN_ENUMERATOR_VERSION = 'deep-macro-plan-enumerator-v1';

const EMPTY = Object.freeze({ shape: '-', color: '-' });
const partCode = part => `${part.shape}${part.color}`;

function trimLayers(layers) {
    let length = layers.length;
    while (length > 1 && layers[length - 1].every(part => part.shape === '-')) length -= 1;
    return layers.slice(0, length);
}

function codeFor(layers) {
    return trimLayers(layers).map(layer => layer.map(partCode).join('')).join(':');
}

function maskTarget(target, quadrants) {
    const kept = new Set(quadrants);
    const layers = parseParts(target).map(layer => layer.map((part, quadrant) => (
        kept.has(quadrant) ? part : EMPTY
    )));
    if (!layers.flat().some(part => part.shape !== '-')) return null;
    return codeFor(layers);
}

function firstPart(code) {
    return parseParts(code).flat().find(part => part.shape !== '-');
}

function buildRefinementPools(builder, bundle) {
    const pools = new Map();
    for (const { shape, count } of bundle.inputs) {
        for (let occurrence = 0; occurrence < count; occurrence++) {
            const columns = partitionIntoColumns(builder, builder.input(shape));
            for (const id of columns) {
                const part = firstPart(builder.shape(id));
                const key = `${part.shape}${part.color}`;
                const ids = pools.get(key) ?? [];
                ids.push(id);
                pools.set(key, ids);
            }
        }
    }
    return pools;
}

function takeRefinementAtom(builder, pools, part, quadrant) {
    const key = `${part.shape}${part.color}`;
    const ids = pools.get(key) ?? [];
    if (!ids.length) throw new Error(`refinement occurrence exhausted for ${key}`);
    return rotateColumnToQuadrant(builder, ids.shift(), quadrant);
}

function rotatedTargets(target, maxLayers) {
    const result = [];
    let shape = Shape.fromShapeCode(target);
    const config = new ShapeOperationConfig(maxLayers);
    for (let rotationTurns = 0; rotationTurns < 4; rotationTurns++) {
        result.push({ rotationTurns, workingTarget: shape.toShapeCode() });
        shape = rotate90CW(shape, config)[0];
    }
    return result;
}

/**
 * Enumerate target/subassembly macro DAGs before any environment is chosen.
 * Every returned item is a construction topology, never an input replacement.
 */
export function enumerateAlternativeMacroPlans(targetCase, maxLayers = 4) {
    const parts = parseParts(targetCase.target).flat();
    const hasPin = parts.some(part => part.shape === 'P');
    const hasCrystal = parts.some(part => part.shape === 'c');
    const plans = [];

    if (hasPin && hasCrystal) {
        for (const route of rotatedTargets(targetCase.target, maxLayers)) {
            try {
                const plan = planMixedPinCrystalSubassembly(route.workingTarget, maxLayers);
                plans.push({
                    id: `native-mixed-r${route.rotationTurns}-${plan.splitLayer}`,
                    macroClass: 'mixed-state-transition-routing',
                    kind: 'native-special-route',
                    ...route,
                });
            } catch { /* another physical orientation may still validate */ }
        }
    } else if (hasPin) {
        for (const route of rotatedTargets(targetCase.target, maxLayers)) {
            try {
                const plan = planPinSubassembly(route.workingTarget, maxLayers);
                plans.push({
                    id: `native-pin-r${route.rotationTurns}-${plan.kind}-${plan.splitLayer ?? 'root'}`,
                    macroClass: 'pin-column-support-partition',
                    kind: 'native-special-route',
                    ...route,
                });
            } catch { /* another physical orientation may still validate */ }
        }
    } else if (hasCrystal) {
        for (const route of rotatedTargets(targetCase.target, maxLayers)) {
            try {
                const plan = planCrystalSubassembly(route.workingTarget, maxLayers);
                plans.push({
                    id: `native-crystal-r${route.rotationTurns}-${plan.kind}`,
                    macroClass: route.rotationTurns
                        ? 'alternate-crystal-staging-boundary' : 'crystal-staging-route',
                    kind: 'native-special-route',
                    ...route,
                });
            } catch { /* another physical orientation may still validate */ }
        }
        const layers = parseParts(targetCase.target);
        const layerLocalEligible = layers.every(layer => {
            const crystals = layer.filter(part => part.shape === 'c');
            return !crystals.length || (layer.every(part => part.shape !== '-')
                && new Set(crystals.map(part => part.color)).size === 1);
        });
        if (layerLocalEligible) {
            plans.push({
                id: 'layer-local-crystal-staging',
                macroClass: 'layer-local-crystal-staging',
                kind: 'layer-local-crystal',
            });
        }
        const crystalColors = [...new Set(layers.flat().filter(part => part.shape === 'c').map(part => part.color))];
        if (crystalColors.length === 1) {
            plans.push({
                id: 'pin-mask-crystal-staging',
                macroClass: 'pin-mask-crystal-staging',
                kind: 'pin-mask-crystal',
                color: crystalColors[0],
            });
        }
        if (crystalColors.length === 1 && layers.every(layer => layer.every(part => part.shape !== '-'))) {
            plans.push({
                id: 'full-stack-pin-mask-crystal-staging',
                macroClass: 'full-stack-pin-mask-crystal-staging',
                kind: 'full-stack-crystal',
                color: crystalColors[0],
            });
        }
        if (crystalColors.length === 2) {
            for (let splitLayer = 1; splitLayer < layers.length; splitLayer++) {
                const lower = layers.slice(0, splitLayer);
                const upper = layers.slice(splitLayer);
                const lowerColors = [...new Set(lower.flat().filter(part => part.shape === 'c').map(part => part.color))];
                const upperColors = [...new Set(upper.flat().filter(part => part.shape === 'c').map(part => part.color))];
                if (lower.every(layer => layer.every(part => part.shape !== '-'))
                    && upper.every(layer => layer.every(part => part.shape === 'c'))
                    && lowerColors.length === 1 && upperColors.length === 1
                    && lowerColors[0] !== upperColors[0]) {
                    plans.push({
                        id: `staged-full-stack-pin-mask-${splitLayer}`,
                        macroClass: 'staged-full-stack-pin-mask-crystal-routing',
                        kind: 'staged-full-stack-crystal',
                        splitLayer,
                        lowerColor: lowerColors[0],
                        upperColor: upperColors[0],
                    });
                }
            }
        }
    } else {
        plans.push({ id: 'native-direct-layered', macroClass: 'direct-layered', kind: 'native-special-route', rotationTurns: 0, workingTarget: targetCase.target });
    }

    plans.push({ id: 'column-first', macroClass: 'column-first-assembly', kind: 'column-first' });
    plans.push({ id: 'half-swapper-axis-0', macroClass: 'independent-half-swapper-assembly', kind: 'half-swapper', rotationTurns: 0 });
    plans.push({ id: 'half-swapper-axis-1', macroClass: 'rotated-half-swapper-assembly', kind: 'half-swapper', rotationTurns: 1 });
    for (let splitLayer = 1; splitLayer < parseParts(targetCase.target).length; splitLayer++) {
        plans.push({
            id: `chunked-upper-half-swapper-${splitLayer}`,
            macroClass: 'chunked-upper-half-recomposition',
            kind: 'chunked-upper-half-swapper',
            splitLayer,
        });
    }

    const unique = new Map();
    for (const plan of plans) if (!unique.has(plan.id)) unique.set(plan.id, plan);
    return [...unique.values()];
}

export function buildMacroPlan(builder, targetCase, catalog, bundle, macroPlan) {
    const allocator = new OrdinaryAtomAllocator(builder, catalog, {
        track: targetCase.track,
        refinementGroup: bundle.group,
    });
    const refinementPools = buildRefinementPools(builder, bundle);
    const targetParts = parseParts(targetCase.target).flat();
    const sacrificialTypes = [
        ...new Set(targetParts.map(part => part.shape)
            .filter(shape => !['-', 'P', 'c', 'X', 'Y'].includes(shape))),
        'C', 'R', 'S', 'W',
    ];
    let sacrificialIndex = 0;

    function buildPart(part, quadrant) {
        if (part.shape === 'P' || part.shape === 'c') throw new Error(`special part ${part.shape} requires a macro subassembly`);
        if (part.shape === 'X' || part.shape === 'Y') return takeRefinementAtom(builder, refinementPools, part, quadrant);
        return allocator.atom(part, quadrant);
    }

    function buildSacrificialPart(quadrant) {
        for (let offset = 0; offset < sacrificialTypes.length; offset++) {
            const shape = sacrificialTypes[(sacrificialIndex + offset) % sacrificialTypes.length];
            try {
                const id = allocator.atom({ shape, color: 'u' }, quadrant);
                sacrificialIndex = (sacrificialIndex + offset + 1) % sacrificialTypes.length;
                return id;
            } catch (error) {
                if (!/no ordinary source available/.test(error.message)) throw error;
            }
        }
        throw new Error('no ordinary source available for sacrificial macro support');
    }

    function buildOrdinary(code) {
        const layerIds = parseParts(code).map(parts => {
            const ids = parts.map((part, quadrant) => part.shape === '-' ? null : buildPart(part, quadrant))
                .filter(id => id !== null);
            if (!ids.length) throw new Error('macro component contains an all-empty physical layer');
            return combineDisjoint(builder, ids);
        });
        const resultId = stackLayers(builder, layerIds);
        if (builder.shape(resultId) !== code) {
            throw new Error(`ordinary macro component gravity changed ${builder.shape(resultId)} instead of ${code}`);
        }
        return resultId;
    }

    function buildComponent(code, selectedPlan = null) {
        const parts = parseParts(code).flat();
        const hasPin = parts.some(part => part.shape === 'P');
        const hasCrystal = parts.some(part => part.shape === 'c');
        const options = { buildPart, buildSacrificialPart, plan: selectedPlan };
        if (hasPin && hasCrystal) return buildMixedPinCrystalSubassembly(builder, code, options).resultId;
        if (hasPin) return buildPinSubassembly(builder, code, options).resultId;
        if (hasCrystal) return buildCrystalSubassembly(builder, code, options).resultId;
        return buildOrdinary(code);
    }

    let resultId;
    if (macroPlan.kind === 'native-special-route') {
        resultId = buildComponent(macroPlan.workingTarget);
        for (let turn = 0; turn < macroPlan.rotationTurns; turn++) {
            resultId = builder.operate('Rotator CCW', [resultId])[0];
        }
    } else if (macroPlan.kind === 'pin-mask-crystal') {
        const pinMaskTarget = parseParts(targetCase.target).map(layer => layer.map(part => (
            part.shape === 'c' ? { shape: 'P', color: '-' } : part
        )).map(partCode).join('')).join(':');
        const pinMask = buildPinSubassembly(builder, pinMaskTarget, {
            buildPart,
            buildSacrificialPart,
        }).resultId;
        resultId = builder.operate('Crystal Generator', [pinMask], { color: macroPlan.color })[0];
    } else if (macroPlan.kind === 'full-stack-crystal') {
        const maskedLayers = parseParts(targetCase.target).map(parts => combineDisjoint(
            builder,
            parts.map((part, quadrant) => part.shape === 'c'
                ? buildIsolatedPin(builder, quadrant, buildSacrificialPart)
                : buildPart(part, quadrant)),
        ));
        const scaffold = stackLayers(builder, maskedLayers);
        resultId = builder.operate('Crystal Generator', [scaffold], { color: macroPlan.color })[0];
    } else if (macroPlan.kind === 'staged-full-stack-crystal') {
        const layers = parseParts(targetCase.target);
        const lowerMasks = layers.slice(0, macroPlan.splitLayer).map(parts => combineDisjoint(
            builder,
            parts.map((part, quadrant) => part.shape === 'c'
                ? buildIsolatedPin(builder, quadrant, buildSacrificialPart)
                : buildPart(part, quadrant)),
        ));
        let staged = builder.operate('Crystal Generator', [stackLayers(builder, lowerMasks)], {
            color: macroPlan.lowerColor,
        })[0];
        const upperMasks = layers.slice(macroPlan.splitLayer).map(() => combineDisjoint(
            builder,
            [0, 1, 2, 3].map(quadrant => buildIsolatedPin(builder, quadrant, buildSacrificialPart)),
        ));
        staged = builder.operate('Stacker', [staged, stackLayers(builder, upperMasks)])[0];
        resultId = builder.operate('Crystal Generator', [staged], { color: macroPlan.upperColor })[0];
    } else if (macroPlan.kind === 'layer-local-crystal') {
        const layerIds = parseParts(targetCase.target).map(parts => {
            const crystals = parts.filter(part => part.shape === 'c');
            if (!crystals.length) return buildOrdinary(parts.map(partCode).join(''));
            if (parts.some(part => part.shape === '-') || new Set(crystals.map(part => part.color)).size !== 1) {
                throw new Error('layer-local Crystal staging requires fully occupied monochrome Crystal-bearing layers');
            }
            const solidIds = parts.map((part, quadrant) => part.shape === 'c' ? null : buildPart(part, quadrant))
                .filter(id => id !== null);
            const scaffold = solidIds.length
                ? combineDisjoint(builder, solidIds)
                : combineDisjoint(builder, parts.map((part, quadrant) => buildIsolatedPin(
                    builder, quadrant, buildSacrificialPart,
                )));
            const result = builder.operate('Crystal Generator', [scaffold], { color: crystals[0].color })[0];
            const expected = parts.map(partCode).join('');
            if (builder.shape(result) !== expected) {
                throw new Error(`layer-local Crystal staging produced ${builder.shape(result)} instead of ${expected}`);
            }
            return result;
        });
        resultId = stackLayers(builder, layerIds);
    } else if (macroPlan.kind === 'removable-solid-mask-crystal') {
        const layers = parseParts(targetCase.target);
        const crystalCells = layers.flatMap((layer, layerIndex) => layer
            .map((part, quadrant) => part.shape === 'c' ? { part, quadrant, layerIndex } : null)
            .filter(Boolean));
        const crystalQuadrants = [...new Set(crystalCells.map(cell => cell.quadrant))];
        const crystalColors = [...new Set(crystalCells.map(cell => cell.part.color))];
        if (crystalQuadrants.length !== 1 || crystalColors.length !== 1) {
            throw new Error('removable solid mask route requires one monochrome Crystal column');
        }
        const crystalQuadrant = crystalQuadrants[0];
        if (layers.some(layer => layer[crystalQuadrant].shape !== 'c')) {
            throw new Error('removable solid mask route requires continuous Crystal occupancy in its column');
        }
        const maskLayers = layers.map(() => combineDisjoint(
            builder,
            [0, 1, 2, 3].filter(quadrant => quadrant !== crystalQuadrant)
                .map(quadrant => allocator.atom({
                    shape: macroPlan.maskShape ?? 'C', color: 'u',
                }, quadrant)),
        ));
        let masked = stackLayers(builder, maskLayers);
        masked = builder.operate('Crystal Generator', [masked], { color: crystalColors[0] })[0];
        const columns = partitionIntoColumns(builder, masked);
        const expectedCrystalColumn = maskTarget(targetCase.target, [crystalQuadrant]);
        let crystalColumn = selectColumn(
            builder,
            columns,
            code => rotatedTargets(code, builder.config.maxShapeLayers)
                .some(route => route.workingTarget === expectedCrystalColumn),
            'removable-mask Crystal column',
        );
        crystalColumn = builder.rotateTo(crystalColumn, expectedCrystalColumn);
        const targetColumns = new Map([[crystalQuadrant, crystalColumn]]);
        for (const quadrant of [0, 1, 2, 3].filter(value => value !== crystalQuadrant)) {
            const code = maskTarget(targetCase.target, [quadrant]);
            if (code) targetColumns.set(quadrant, buildComponent(code));
        }
        if (macroPlan.recomposition === 'stacker') {
            const ids = [crystalColumn, ...[0, 1, 2, 3]
                .filter(quadrant => quadrant !== crystalQuadrant)
                .map(quadrant => targetColumns.get(quadrant)).filter(Boolean)];
            resultId = combineDisjoint(builder, ids);
        } else {
            const buildHalf = quadrants => {
                const ids = quadrants.map(quadrant => targetColumns.get(quadrant)).filter(Boolean);
                ids.sort((left, right) => (left === crystalColumn ? -1 : 0) - (right === crystalColumn ? -1 : 0));
                return combineDisjoint(builder, ids);
            };
            const leftHalf = buildHalf([0, 1]);
            const rightHalf = buildHalf([2, 3]);
            const halfCodes = [builder.shape(leftHalf), builder.shape(rightHalf)];
            const recomposed = builder.operate('Swapper', [leftHalf, rightHalf]);
            resultId = recomposed.find(id => builder.shape(id) === targetCase.target);
            if (resultId === undefined) {
                throw new Error(`removable solid mask halves ${halfCodes.join(' + ')} produced ${recomposed.map(id => builder.shape(id)).join(', ')}`);
            }
        }
    } else if (macroPlan.kind === 'column-first') {
        const columns = [0, 1, 2, 3].map(quadrant => maskTarget(targetCase.target, [quadrant]))
            .filter(Boolean).map(code => buildComponent(code));
        resultId = combineDisjoint(builder, columns);
    } else if (macroPlan.kind === 'half-swapper') {
        let working = Shape.fromShapeCode(targetCase.target);
        for (let turn = 0; turn < macroPlan.rotationTurns; turn++) working = rotate90CW(working, builder.config)[0];
        const workingTarget = working.toShapeCode();
        const leftCode = maskTarget(workingTarget, [0, 1]);
        const rightCode = maskTarget(workingTarget, [2, 3]);
        if (!leftCode || !rightCode) throw new Error('half-swapper route requires two non-empty spatial components');
        const outputs = builder.operate('Swapper', [buildComponent(leftCode), buildComponent(rightCode)]);
        resultId = outputs.find(id => builder.shape(id) === workingTarget);
        if (resultId === undefined) throw new Error(`half-swapper recomposition did not produce ${workingTarget}`);
        for (let turn = 0; turn < macroPlan.rotationTurns; turn++) {
            resultId = builder.operate('Rotator CCW', [resultId])[0];
        }
    } else if (macroPlan.kind === 'chunked-upper-half-swapper') {
        const layers = parseParts(targetCase.target);
        const lowerCode = codeFor(layers.slice(0, macroPlan.splitLayer));
        const upperCode = codeFor(layers.slice(macroPlan.splitLayer));
        const leftCode = maskTarget(upperCode, [0, 1]);
        const rightCode = maskTarget(upperCode, [2, 3]);
        if (!leftCode || !rightCode) throw new Error('chunked upper route requires two non-empty halves');
        const outputs = builder.operate('Swapper', [buildComponent(leftCode), buildComponent(rightCode)]);
        const upperId = outputs.find(id => builder.shape(id) === upperCode);
        if (upperId === undefined) throw new Error(`chunked upper recomposition did not produce ${upperCode}`);
        resultId = builder.operate('Stacker', [buildComponent(lowerCode), upperId])[0];
    } else {
        throw new Error(`unknown macro plan kind ${macroPlan.kind}`);
    }
    if (builder.shape(resultId) !== targetCase.target) {
        throw new Error(`macro plan ${macroPlan.id} produced ${builder.shape(resultId)} instead of ${targetCase.target}`);
    }
    return resultId;
}
