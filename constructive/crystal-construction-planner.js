import {
    Shape, ShapeOperationConfig, cut, genCrystal, stack, swapHalves,
} from '../shapeOperations.js';
import { combineDisjoint, parseParts, stackLayers } from '../constructiveSolverRuntime.js';
import { buildIsolatedPin, buildPinSubassembly } from './pin-construction-planner.js';

export const CRYSTAL_CONSTRUCTION_PLANNER_VERSION = 'generic-crystal-construction-v3';

export const CRYSTAL_CONSTRUCTION_CAPABILITIES = Object.freeze([
    {
        id: 'single-color-half-scaffold',
        mechanisms: ['non-uniform Crystal region', 'temporary solid scaffold', 'Cutter extraction'],
    },
    {
        id: 'boundary-shatter-empty-preservation',
        mechanisms: ['sacrificial Crystal', 'connected Crystal breakage', 'target empty preservation'],
    },
    {
        id: 'swapper-half-recomposition',
        mechanisms: ['Crystal-bearing lower-level geometry', 'Swapper recomposition', 'byproduct lineage'],
    },
    {
        id: 'staged-full-layer-refinement-mask',
        mechanisms: ['multi-color Crystal stages', 'real Pin/empty eligibility mask', 'occupied-region protection'],
    },
    {
        id: 'sparse-upper-refinement-mask',
        mechanisms: ['spatial component decomposition', 'physical Pin/solid masks', 'pre-recomposition mask removal'],
    },
]);

const EMPTY = Object.freeze({ shape: '-', color: '-' });
const partCode = part => `${part.shape}${part.color}`;
const layerCode = parts => parts.map(partCode).join('');
const isEmptyLayer = parts => parts.every(part => part.shape === '-');

function trimEmptyUpperLayers(layers) {
    let length = layers.length;
    while (length > 1 && isEmptyLayer(layers[length - 1])) length -= 1;
    return layers.slice(0, length);
}

function countCrystals(code) {
    return parseParts(code).flat().filter(part => part.shape === 'c').length;
}

function stackLayerCodes(codes, maxLayers) {
    if (!codes.length || codes.some(code => code === '--------')) return null;
    const config = new ShapeOperationConfig(maxLayers);
    let result = Shape.fromShapeCode(codes[0]);
    for (const code of codes.slice(1)) result = stack(result, Shape.fromShapeCode(code), config)[0];
    return result.toShapeCode();
}

function expectedHalfCode(layers, keptQuadrants) {
    const masked = layers.map(layer => layer.map((part, quadrant) => keptQuadrants.has(quadrant) ? part : EMPTY));
    return trimEmptyUpperLayers(masked).map(layerCode).join(':');
}

const SPATIAL_HALVES = Object.freeze([
    {
        id: 'left',
        quadrants: Object.freeze([0, 1]),
        opposite: Object.freeze([2, 3]),
        cutPartners: Object.freeze({ 0: 3, 1: 2 }),
    },
    {
        id: 'right',
        quadrants: Object.freeze([2, 3]),
        opposite: Object.freeze([0, 1]),
        cutPartners: Object.freeze({ 2: 1, 3: 0 }),
    },
]);

function replaceOutsideHalf(layers, quadrants, replacement) {
    const kept = new Set(quadrants);
    return layers.map(layer => layer.map((part, quadrant) => kept.has(quadrant) ? part : replacement));
}

function shapeFromLayers(layers) {
    return trimEmptyUpperLayers(layers).map(layerCode).join(':');
}

function cutOutput(code, expected, maxLayers) {
    return cut(Shape.fromShapeCode(code), new ShapeOperationConfig(maxLayers))
        .map(shape => shape.toShapeCode()).find(output => output === expected) ?? null;
}

function scaffoldCandidate(layers, keptQuadrants, discardedQuadrants, mask, color, maxLayers) {
    let bit = 0;
    let sacrificialSolidCount = 0;
    const directives = layers.map(layer => layer.map((part, quadrant) => {
        if (keptQuadrants.has(quadrant)) {
            if (part.shape === 'c') {
                if (part.color !== color) return null;
                return { kind: 'crystal-hole' };
            }
            return part.shape === '-' ? { kind: 'target-empty' } : { kind: 'target', part };
        }
        const solid = Boolean(mask & (1 << bit++));
        if (solid) sacrificialSolidCount += 1;
        return solid ? { kind: 'sacrificial-solid' } : { kind: 'sacrificial-crystal' };
    }));
    if (directives.flat().some(value => value === null)) return null;
    const scaffoldLayers = directives.map(layer => layer.map(directive => (
        ['target', 'sacrificial-solid'].includes(directive.kind)
            ? (directive.part ?? { shape: 'C', color: 'u' })
            : EMPTY
    )));
    const scaffoldCodes = scaffoldLayers.map(layerCode);
    const scaffoldCode = scaffoldCodes.join(':');
    if (stackLayerCodes(scaffoldCodes, maxLayers) !== scaffoldCode) return null;

    const generated = genCrystal(Shape.fromShapeCode(scaffoldCode), color, new ShapeOperationConfig(maxLayers))[0];
    const outputs = cut(generated, new ShapeOperationConfig(maxLayers));
    const expected = expectedHalfCode(layers, keptQuadrants);
    const lane = keptQuadrants.has(0) ? 1 : 0;
    if (outputs[lane].toShapeCode() !== expected) return null;

    const generatedCrystalCount = countCrystals(generated.toShapeCode());
    const survivingCrystalCount = outputs.reduce((sum, output) => sum + countCrystals(output.toShapeCode()), 0);
    return {
        directives,
        scaffoldCode,
        expected,
        lane,
        sacrificialSolidCount,
        extraGeneratedCrystalCount: generatedCrystalCount - countCrystals(expected),
        breakageCount: generatedCrystalCount - survivingCrystalCount,
    };
}

function planHalf(layers, quadrants, color, maxLayers) {
    const keptQuadrants = new Set(quadrants);
    const discardedQuadrants = Array.from({ length: 4 }, (_, quadrant) => quadrant)
        .filter(quadrant => !keptQuadrants.has(quadrant));
    const candidateCount = 1 << (discardedQuadrants.length * layers.length);
    const candidates = [];
    for (let mask = 0; mask < candidateCount; mask++) {
        const candidate = scaffoldCandidate(
            layers, keptQuadrants, discardedQuadrants, mask, color, maxLayers,
        );
        if (candidate) candidates.push(candidate);
    }
    candidates.sort((a, b) => a.extraGeneratedCrystalCount - b.extraGeneratedCrystalCount
        || a.breakageCount - b.breakageCount
        || a.sacrificialSolidCount - b.sacrificialSolidCount
        || a.scaffoldCode.localeCompare(b.scaffoldCode));
    if (!candidates.length) {
        throw new Error(`Crystal construction unsupported: no canonical half-scaffold for quadrants ${quadrants.join(',')}`);
    }
    return { quadrants, ...candidates[0] };
}

function planSingleColor(layers, maxLayers) {
    const crystals = layers.flat().filter(part => part.shape === 'c');
    const colors = [...new Set(crystals.map(part => part.color))];
    if (colors.length !== 1) return null;
    const color = colors[0];
    const halves = [
        planHalf(layers, [0, 1], color, maxLayers),
        planHalf(layers, [2, 3], color, maxLayers),
    ];
    return {
        kind: 'single-color-half-scaffold',
        color,
        halves,
        usesDeliberateBreakage: halves.some(half => half.breakageCount > 0),
        breakageCount: halves.reduce((sum, half) => sum + half.breakageCount, 0),
        sacrificialSolidCount: halves.reduce((sum, half) => sum + half.sacrificialSolidCount, 0),
    };
}

function previewStagedPlan(plan, maxLayers) {
    const config = new ShapeOperationConfig(maxLayers);
    let shape = Shape.fromShapeCode(plan.stages[0].target);
    for (const maskCode of plan.stages[1].maskLayers) {
        shape = stack(shape, Shape.fromShapeCode(maskCode), config)[0];
    }
    return genCrystal(shape, plan.stages[1].color, config)[0].toShapeCode();
}

/**
 * Rechecks a staged plan only through canonical forward mechanics.  Keeping
 * this check public lets focused regressions prove that ordering and mask
 * geometry are semantic requirements rather than planner annotations.
 */
export function validateStagedRefinementMaskPlan(target, plan, maxLayers = 4) {
    const errors = [];
    if (plan?.kind !== 'staged-full-layer-refinement-mask') {
        errors.push('plan is not a staged full-layer refinement mask');
        return { valid: false, errors, result: null };
    }
    if (!Array.isArray(plan.stages) || plan.stages.length !== 2) {
        errors.push('staged refinement mask requires exactly two ordered stages');
        return { valid: false, errors, result: null };
    }
    if (plan.stages[0].color === plan.stages[1].color) errors.push('stage colors must differ');
    if (!plan.stages[1].maskLayers?.length) errors.push('second stage requires real mask geometry');
    let result = null;
    if (!errors.length) {
        try {
            result = previewStagedPlan(plan, maxLayers);
            if (result !== target) errors.push(`canonical staged replay produced ${result} instead of ${target}`);
        } catch (error) {
            errors.push(`canonical staged replay failed: ${error.message}`);
        }
    }
    return { valid: errors.length === 0, errors, result };
}

function planStagedFullLayerMask(target, layers, maxLayers) {
    const candidates = [];
    for (let splitLayer = 1; splitLayer < layers.length; splitLayer++) {
        const protectedLayers = layers.slice(0, splitLayer);
        const refinementLayers = layers.slice(splitLayer);
        if (protectedLayers.flat().some(part => part.shape === '-')) continue;
        if (!refinementLayers.flat().every(part => part.shape === 'c')) continue;
        const refinementColors = [...new Set(refinementLayers.flat().map(part => part.color))];
        if (refinementColors.length !== 1) continue;
        const base = planSingleColor(protectedLayers, maxLayers);
        if (!base || base.color === refinementColors[0]) continue;

        // A single isolated Pin makes each new layer physically exist.  Pin and
        // the remaining empty cells are all canonical Generator-eligible; every
        // protected cell below is occupied and therefore retains its old color.
        const maskLayers = refinementLayers.map(() => 'P-------');
        const plan = {
            kind: 'staged-full-layer-refinement-mask',
            splitLayer,
            base,
            stages: [
                {
                    index: 0,
                    color: base.color,
                    target: protectedLayers.map(layerCode).join(':'),
                    protectedCellCount: protectedLayers.flat().length,
                },
                {
                    index: 1,
                    color: refinementColors[0],
                    target: refinementLayers.map(layerCode).join(':'),
                    maskKind: 'isolated-pin-plus-eligible-empty',
                    maskLayers,
                    eligibleCellCount: refinementLayers.flat().length,
                },
            ],
            usesDeliberateBreakage: true,
            targetCrystalBreakageCount: 0,
            sacrificialPinCount: maskLayers.length,
        };
        const validation = validateStagedRefinementMaskPlan(target, plan, maxLayers);
        if (validation.valid) candidates.push(plan);
    }
    candidates.sort((a, b) => a.sacrificialPinCount - b.sacrificialPinCount
        || b.splitLayer - a.splitLayer
        || a.stages[0].target.localeCompare(b.stages[0].target));
    if (candidates.length) return candidates[0];
    throw new Error('Crystal construction unsupported: staged refinement-mask requires a fully occupied single-color base and a full monochrome Crystal suffix');
}

function previewSparseUpperPlan(plan, maxLayers) {
    const config = new ShapeOperationConfig(maxLayers);
    const refinementUpper = stackLayerCodes(plan.refinementComponent.maskLayers, maxLayers);
    if (!refinementUpper) return { result: null, refinementHalf: null, otherHalf: null };
    let refinementAssembly = stack(
        Shape.fromShapeCode(plan.refinementComponent.baseScaffold),
        Shape.fromShapeCode(refinementUpper),
        config,
    )[0];
    refinementAssembly = genCrystal(refinementAssembly, plan.refinementColor, config)[0];
    const refinementHalf = cutOutput(
        refinementAssembly.toShapeCode(), plan.refinementComponent.expected, maxLayers,
    );

    let otherAssembly = Shape.fromShapeCode(plan.otherComponent.baseScaffold);
    if (plan.otherComponent.upper) {
        otherAssembly = stack(otherAssembly, Shape.fromShapeCode(plan.otherComponent.upper), config)[0];
    }
    const otherHalf = cutOutput(otherAssembly.toShapeCode(), plan.otherComponent.expected, maxLayers);
    if (!refinementHalf || !otherHalf) return { result: null, refinementHalf, otherHalf };
    const result = swapHalves(
        Shape.fromShapeCode(refinementHalf), Shape.fromShapeCode(otherHalf), config,
    ).map(shape => shape.toShapeCode()).find(code => code === plan.target) ?? null;
    return { result, refinementHalf, otherHalf };
}

/**
 * Replays the sparse-mask topology with canonical mechanics.  The physical
 * masks are part of the plan: Pins identify Generator-eligible cells, ordinary
 * solids protect the discarded half, and paired Pins create sacrificial
 * Crystal across a Cutter boundary.
 */
export function validateSparseUpperMaskPlan(target, plan, maxLayers = 4) {
    const errors = [];
    if (plan?.kind !== 'sparse-upper-refinement-mask') {
        return { valid: false, errors: ['plan is not a sparse upper refinement mask'], result: null };
    }
    if (plan.target !== target) errors.push('sparse plan target mismatch');
    if (!plan.refinementComponent?.maskLayers?.length) errors.push('sparse plan requires physical upper mask layers');
    let preview = { result: null, refinementHalf: null, otherHalf: null };
    if (!errors.length) {
        try {
            preview = previewSparseUpperPlan(plan, maxLayers);
            if (preview.result !== target) errors.push(`canonical sparse replay did not produce ${target}`);
        } catch (error) {
            errors.push(`canonical sparse replay failed: ${error.message}`);
        }
    }
    return { valid: errors.length === 0, errors, ...preview };
}

function planSparseUpperMask(target, layers, maxLayers) {
    const candidates = [];
    for (let splitLayer = 1; splitLayer < layers.length; splitLayer++) {
        const baseLayers = layers.slice(0, splitLayer);
        const upperLayers = layers.slice(splitLayer);
        if (!baseLayers.flat().every(part => part.shape === 'c')) continue;
        const baseColors = [...new Set(baseLayers.flat().map(part => part.color))];
        if (baseColors.length !== 1) continue;
        const upperCrystals = upperLayers.flat().filter(part => part.shape === 'c');
        const refinementColors = [...new Set(upperCrystals.map(part => part.color))];
        if (refinementColors.length !== 1 || refinementColors[0] === baseColors[0]) continue;
        if (!upperLayers.flat().some(part => part.shape === '-')) continue;

        for (const half of SPATIAL_HALVES) {
            const kept = new Set(half.quadrants);
            if (upperLayers.some(layer => layer.some((part, quadrant) => (
                part.shape === 'c' && !kept.has(quadrant)
            )))) continue;
            if (!upperLayers.some(layer => layer.some((part, quadrant) => (
                part.shape === 'c' && kept.has(quadrant)
            )))) continue;

            const sacrificial = { shape: 'C', color: 'u' };
            const refinementBaseLayers = replaceOutsideHalf(baseLayers, half.quadrants, sacrificial);
            const otherBaseLayers = replaceOutsideHalf(baseLayers, half.opposite, sacrificial);
            const maskLayers = upperLayers.map(layer => {
                const masked = layer.map((part, quadrant) => {
                    if (!kept.has(quadrant)) return sacrificial;
                    if (part.shape === 'c' || part.shape === '-') return { shape: 'P', color: '-' };
                    return part;
                });
                for (const quadrant of half.quadrants) {
                    if (layer[quadrant].shape !== '-') continue;
                    masked[half.cutPartners[quadrant]] = { shape: 'P', color: '-' };
                }
                return masked;
            });
            const otherUpperLayers = replaceOutsideHalf(upperLayers, half.opposite, EMPTY);
            const refinementExpected = expectedHalfCode(layers, kept);
            const otherExpected = expectedHalfCode(layers, new Set(half.opposite));
            const plan = {
                kind: 'sparse-upper-refinement-mask',
                target,
                splitLayer,
                baseColor: baseColors[0],
                refinementColor: refinementColors[0],
                refinementHalf: half.id,
                refinementComponent: {
                    quadrants: [...half.quadrants],
                    baseScaffold: shapeFromLayers(refinementBaseLayers),
                    maskLayers: maskLayers.map(layerCode),
                    expected: refinementExpected,
                },
                otherComponent: {
                    quadrants: [...half.opposite],
                    baseScaffold: shapeFromLayers(otherBaseLayers),
                    upper: shapeFromLayers(otherUpperLayers),
                    expected: otherExpected,
                },
                usesDeliberateBreakage: true,
                targetCrystalBreakageCount: 0,
                sacrificialMaskCellCount: maskLayers.flat().filter(part => part.shape === 'P').length
                    - upperCrystals.length,
            };
            if (plan.otherComponent.upper === '--------') plan.otherComponent.upper = null;
            const validation = validateSparseUpperMaskPlan(target, plan, maxLayers);
            if (validation.valid) candidates.push(plan);
        }
    }
    candidates.sort((a, b) => a.sacrificialMaskCellCount - b.sacrificialMaskCellCount
        || b.splitLayer - a.splitLayer || a.refinementHalf.localeCompare(b.refinementHalf));
    if (candidates.length) return candidates[0];
    throw new Error('Crystal construction unsupported: no canonical sparse-upper physical-mask decomposition survived safe pre-recomposition removal');
}

/**
 * Plans a target-derived, but target-id-independent, Crystal construction.
 *
 * The v1 capability deliberately claims only one Crystal color. Each spatial
 * half is generated inside a solid scaffold; target-empty Crystal components
 * are made to cross the canonical cut boundary and shatter, while wanted
 * components remain on the retained side. The two exact halves are recombined
 * by the canonical Swapper, avoiding unsafe Crystal-bearing upper Stack input.
 */
export function planCrystalSubassembly(target, maxLayers = 4) {
    const layers = parseParts(target);
    const crystals = layers.flat().filter(part => part.shape === 'c');
    if (!crystals.length) throw new Error('Crystal construction planner requires a Crystal target');
    if (layers.flat().some(part => part.shape === 'P')) {
        throw new Error('Crystal construction planner does not claim mixed Pin/Crystal targets');
    }
    const colors = [...new Set(crystals.map(part => part.color))];
    if (colors.length === 1) return planSingleColor(layers, maxLayers);
    if (colors.length === 2) {
        try {
            return planStagedFullLayerMask(target, layers, maxLayers);
        } catch (fullLayerError) {
            try {
                const plan = planSparseUpperMask(target, layers, maxLayers);
                plan.priorRejections = [{
                    capability: 'staged-full-layer-refinement-mask',
                    reason: fullLayerError.message,
                }];
                return plan;
            } catch (sparseError) {
                throw new Error(`${fullLayerError.message}; ${sparseError.message}`);
            }
        }
    }
    throw new Error(`Crystal construction unsupported: ${colors.length} Crystal colors exceed the two-stage refinement-mask capability`);
}

function buildHalf(builder, half, color, buildPart, buildSacrificialPart) {
    const layerIds = half.directives.map(layer => {
        const ids = layer.map((directive, quadrant) => {
            if (directive.kind === 'target') return buildPart(directive.part, quadrant);
            if (directive.kind === 'sacrificial-solid') return buildSacrificialPart(quadrant);
            return null;
        }).filter(id => id !== null);
        if (!ids.length) throw new Error('Crystal scaffold layer unexpectedly has no solid support');
        return combineDisjoint(builder, ids);
    });
    let scaffold = stackLayers(builder, layerIds);
    scaffold = builder.operate('Crystal Generator', [scaffold], { color })[0];
    const outputs = builder.operate('Cutter', [scaffold]);
    const kept = outputs.find(id => builder.shape(id) === half.expected);
    if (kept === undefined) throw new Error(`Crystal half extraction did not produce ${half.expected}`);
    return kept;
}

function buildConcreteLayers(builder, code, buildPart) {
    const layers = parseParts(code);
    const layerIds = layers.map(parts => combineDisjoint(
        builder,
        parts.map((part, quadrant) => part.shape === '-' ? null : buildPart(part, quadrant))
            .filter(id => id !== null),
    ));
    const resultId = stackLayers(builder, layerIds);
    if (builder.shape(resultId) !== code) {
        throw new Error(`sparse component gravity changed ${builder.shape(resultId)} instead of ${code}`);
    }
    return resultId;
}

function buildSparseUpperMask(builder, target, plan, { buildPart, buildSacrificialPart }) {
    const buildBaseScaffold = code => buildCrystalSubassembly(builder, code, {
        buildPart,
        buildSacrificialPart,
    }).resultId;

    const refinementBase = buildBaseScaffold(plan.refinementComponent.baseScaffold);
    const maskTarget = plan.refinementComponent.maskLayers.join(':');
    const mask = buildPinSubassembly(builder, maskTarget, { buildPart, buildSacrificialPart }).resultId;
    let refinementAssembly = builder.operate('Stacker', [refinementBase, mask])[0];
    refinementAssembly = builder.operate(
        'Crystal Generator', [refinementAssembly], { color: plan.refinementColor },
    )[0];
    const refinementOutputs = builder.operate('Cutter', [refinementAssembly]);
    const refinementHalf = refinementOutputs.find(id => builder.shape(id) === plan.refinementComponent.expected);
    if (refinementHalf === undefined) {
        throw new Error(`sparse mask removal did not preserve ${plan.refinementComponent.expected}`);
    }

    const otherBase = buildBaseScaffold(plan.otherComponent.baseScaffold);
    let otherAssembly = otherBase;
    if (plan.otherComponent.upper) {
        const upper = buildConcreteLayers(builder, plan.otherComponent.upper, buildPart);
        otherAssembly = builder.operate('Stacker', [otherBase, upper])[0];
    }
    const otherOutputs = builder.operate('Cutter', [otherAssembly]);
    const otherHalf = otherOutputs.find(id => builder.shape(id) === plan.otherComponent.expected);
    if (otherHalf === undefined) {
        throw new Error(`sparse component preparation did not preserve ${plan.otherComponent.expected}`);
    }

    const recomposed = builder.operate('Swapper', [refinementHalf, otherHalf]);
    const resultId = recomposed.find(id => builder.shape(id) === target);
    if (resultId === undefined) throw new Error(`sparse Crystal recomposition did not produce ${target}`);
    return resultId;
}

export function buildCrystalSubassembly(builder, target, { buildPart, buildSacrificialPart }) {
    const plan = planCrystalSubassembly(target, builder.config.maxShapeLayers);
    if (plan.kind === 'sparse-upper-refinement-mask') {
        builder.priorConstructionAttempts = plan.priorRejections?.map(rejection => ({
            strategy: `generic-crystal-${rejection.capability}`,
            accepted: false,
            category: 'Crystal construction unsupported',
            reason: rejection.reason,
        })) ?? [];
        const resultId = buildSparseUpperMask(
            builder, target, plan, { buildPart, buildSacrificialPart },
        );
        return { resultId, plan };
    }
    if (plan.kind === 'staged-full-layer-refinement-mask') {
        const baseTarget = plan.stages[0].target;
        const baseBuild = buildCrystalSubassembly(builder, baseTarget, { buildPart, buildSacrificialPart });
        let mask = null;
        for (const [index, expected] of plan.stages[1].maskLayers.entries()) {
            const pin = buildIsolatedPin(builder, 0, buildSacrificialPart);
            if (builder.shape(pin) !== expected) {
                throw new Error(`staged refinement mask layer ${index} produced ${builder.shape(pin)} instead of ${expected}`);
            }
            mask = mask === null ? pin : builder.operate('Stacker', [mask, pin])[0];
        }
        let staged = builder.operate('Stacker', [baseBuild.resultId, mask])[0];
        staged = builder.operate('Crystal Generator', [staged], { color: plan.stages[1].color })[0];
        if (builder.shape(staged) !== target) {
            throw new Error(`staged Crystal construction result ${builder.shape(staged)} != ${target}`);
        }
        return { resultId: staged, plan };
    }
    const halves = plan.halves.map(half => buildHalf(
        builder, half, plan.color, buildPart, buildSacrificialPart,
    ));
    const outputs = builder.operate('Swapper', halves);
    const resultId = outputs.find(id => builder.shape(id) === target);
    if (resultId === undefined) throw new Error(`Crystal construction result did not produce ${target}`);
    return { resultId, plan };
}

