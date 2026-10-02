import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, swapHalves, stack,
    topPaint, pushPin, genCrystal,
} from '../../shapeOperations.js';
import { validateShapeCode } from '../../shapeValidation.js';
import { COLOR_CODES, PART_CODES, UNPAINTABLE_PARTS } from '../../shapeConstants.js';

export const BENCHMARK_SCHEMA_VERSION = 3;
export const CATALOG_SCHEMA_VERSION = 2;
export const GAME_SEMANTICS = 'shape-operations-v1';
export const MAX_LAYERS = 4;

const VALID_COLORS = new Set(Object.values(COLOR_CODES));
const REFINEMENT_MODULE_TYPES = new Set([PART_CODES.REFINED, PART_CODES.EXOTIC]);
const OPERATIONS = Object.freeze({
    Splitter: { arity: 1, splitter: true },
    'Rotator CW': { fn: rotate90CW, arity: 1 },
    'Rotator CCW': { fn: rotate90CCW, arity: 1 },
    'Rotator 180': { fn: rotate180, arity: 1 },
    'Half Destroyer': { fn: halfCut, arity: 1 },
    Cutter: { fn: cut, arity: 1 },
    Swapper: { fn: swapHalves, arity: 2, unorderedOutputs: true },
    Stacker: { fn: stack, arity: 2 },
    Painter: { fn: topPaint, arity: 1, color: true },
    'Pin Pusher': { fn: pushPin, arity: 1 },
    'Crystal Generator': { fn: genCrystal, arity: 1, color: true },
});

export function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function artifactContentHash(artifact) {
    return sha256(canonicalJson(artifact));
}

export function artifactInstancesHash(instances) {
    return sha256(canonicalJson(instances));
}

export async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}

export function canonicalMultiset(inputs) {
    const counts = new Map();
    for (const input of inputs ?? []) {
        counts.set(input.shape, (counts.get(input.shape) ?? 0) + input.count);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([shape, count]) => `${shape}*${count}`).join('|');
}

export function availableInputsFor(instance) {
    return instance?.availableInputs ?? instance?.inputs ?? [];
}

export function multisetRows(inputs) {
    const counts = new Map();
    for (const input of inputs ?? []) counts.set(input.shape, (counts.get(input.shape) ?? 0) + input.count);
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([shape, count]) => ({ shape, count }));
}

export function multisetDelta(leftRows, rightRows) {
    const left = new Map(multisetRows(leftRows).map(input => [input.shape, input.count]));
    const right = new Map(multisetRows(rightRows).map(input => [input.shape, input.count]));
    const removed = [];
    const added = [];
    for (const shape of new Set([...left.keys(), ...right.keys()])) {
        const difference = (right.get(shape) ?? 0) - (left.get(shape) ?? 0);
        if (difference > 0) added.push({ shape, count: difference });
        if (difference < 0) removed.push({ shape, count: -difference });
    }
    removed.sort((a, b) => a.shape.localeCompare(b.shape));
    added.sort((a, b) => a.shape.localeCompare(b.shape));
    return { removed, added };
}

export function instanceContentHash(instance) {
    if (instance.schemaVersion === 3) {
        return sha256(canonicalJson({
            target: instance.target,
            coreWitnessBasis: canonicalMultiset(instance.coreWitnessBasis),
            availableInputs: canonicalMultiset(instance.availableInputs),
            expansion: instance.expansion,
            witness: instance.witness,
        }));
    }
    return sha256(canonicalJson({ target: instance.target, inputs: canonicalMultiset(instance.inputs), witness: instance.witness }));
}

export function parseParts(shapeCode) {
    return shapeCode.split(':').map(layer => {
        const parts = [];
        for (let i = 0; i < layer.length; i += 2) parts.push({ shape: layer[i], color: layer[i + 1] });
        return parts;
    });
}

function refinementFeatureKey(part) {
    return `${part.shape}:${part.color}`;
}

function refinementFeatureLabel(part) {
    return `${part.shape}${part.color}`;
}

export function assertShape(shapeCode, context, { maxLayers = MAX_LAYERS, allowEmpty = false } = {}) {
    const result = validateShapeCode(shapeCode);
    if (!result.isValid) throw new Error(`${context}: invalid shape code: ${result.errors.join('; ')}`);
    const shape = Shape.fromShapeCode(shapeCode);
    if (shape.numParts !== 4) throw new Error(`${context}: benchmark shapes must have four parts per layer`);
    if (shape.numLayers > maxLayers) throw new Error(`${context}: exceeds maxLayers=${maxLayers}`);
    if (!allowEmpty && shape.isEmpty()) throw new Error(`${context}: empty shapes are not legal resources`);
    for (const [layerIndex, layer] of shape.layers.entries()) {
        for (const [partIndex, part] of layer.entries()) {
            if ((part.shape === PART_CODES.NOTHING || part.shape === PART_CODES.PIN) && part.color !== PART_CODES.NOTHING) {
                throw new Error(`${context}: illegal color on empty/pin at ${layerIndex}:${partIndex}`);
            }
            if (part.shape !== PART_CODES.NOTHING && part.shape !== PART_CODES.PIN && !VALID_COLORS.has(part.color)) {
                throw new Error(`${context}: illegal part color at ${layerIndex}:${partIndex}`);
            }
        }
    }
    return shape;
}

export function compileCatalog(catalog) {
    const ordinary = new Map();
    for (const category of ['pure', 'full', 'partial', 'half']) {
        for (const shape of catalog.ordinary?.[category] ?? []) {
            if (ordinary.has(shape)) throw new Error(`catalog duplicates ordinary shape ${shape}`);
            assertShape(shape, `catalog ordinary.${category}`);
            ordinary.set(shape, category);
        }
    }
    const excluded = new Set(catalog.ordinary?.pure_excluded ?? []);
    const refinement = new Map();
    const refinementPartGroups = new Map();
    for (const [group, definition] of Object.entries(catalog.refinement ?? {})) {
        for (const [shape, count] of Object.entries(definition.inputs ?? {})) {
            assertShape(shape, `catalog refinement.${group}`);
            if (!Number.isInteger(count) || count < 1) throw new Error(`invalid refinement count ${group}/${shape}`);
            if (refinement.has(shape)) throw new Error(`refinement input belongs to multiple groups: ${shape}`);
            refinement.set(shape, { group, count });
            for (const part of parseParts(shape).flat()) {
                if (part.shape === PART_CODES.NOTHING) continue;
                if (!REFINEMENT_MODULE_TYPES.has(part.shape)) {
                    throw new Error(`catalog refinement.${group}/${shape} contains non-refinement part ${refinementFeatureLabel(part)}`);
                }
                const key = refinementFeatureKey(part);
                const priorGroup = refinementPartGroups.get(key);
                if (priorGroup && priorGroup !== group) {
                    throw new Error(`refinement feature ${refinementFeatureLabel(part)} belongs to multiple groups: ${priorGroup}, ${group}`);
                }
                refinementPartGroups.set(key, group);
            }
        }
    }
    return { ordinary, excluded, refinement, refinementPartGroups };
}

export class RefinementClassificationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RefinementClassificationError';
    }
}

export function classifyTargetRefinement(target, compiled) {
    try {
        assertShape(target, 'target');
    } catch (error) {
        throw new RefinementClassificationError(error.message);
    }
    const groups = new Set();
    const unknown = new Set();
    const features = new Set();
    for (const part of parseParts(target).flat()) {
        if (!REFINEMENT_MODULE_TYPES.has(part.shape)) continue;
        const label = refinementFeatureLabel(part);
        features.add(label);
        const key = refinementFeatureKey(part);
        const group = compiled.refinementPartGroups.get(key);
        if (group) groups.add(group); else unknown.add(label);
    }
    if (unknown.size) {
        throw new RefinementClassificationError(`target has refinement parts absent from catalog mapping: ${[...unknown].join(', ')}`);
    }
    if (groups.size > 1) {
        throw new RefinementClassificationError(`target maps to multiple refinement groups: ${[...groups].join(', ')}`);
    }
    return { group: [...groups][0] ?? null, features: [...features] };
}

export function targetRefinementGroup(target, compiled) {
    return classifyTargetRefinement(target, compiled).group;
}

export function refinementBundleForTarget(target, compiled) {
    const classification = classifyTargetRefinement(target, compiled);
    const inputs = classification.group
        ? [...compiled.refinement]
            .filter(([, requirement]) => requirement.group === classification.group)
            .map(([shape, requirement]) => ({ shape, count: requirement.count }))
        : [];
    return { ...classification, inputs };
}

export function validateInputRules(instance, catalog) {
    const errors = [];
    let compiled;
    try { compiled = compileCatalog(catalog); } catch (error) { return { valid: false, errors: [error.message] }; }
    try { assertShape(instance.target, 'target'); } catch (error) { errors.push(error.message); }
    const counts = new Map();
    for (const [index, input] of availableInputsFor(instance).entries()) {
        if (!input || typeof input.shape !== 'string' || !Number.isInteger(input.count) || input.count < 1) {
            errors.push(`input ${index}: expected {shape,count>=1}`);
            continue;
        }
        counts.set(input.shape, (counts.get(input.shape) ?? 0) + input.count);
    }
    let targetGroup = null;
    try { targetGroup = targetRefinementGroup(instance.target, compiled); } catch (error) { errors.push(error.message); }
    let pureTypes = 0;
    for (const [shape, count] of counts) {
        if (compiled.excluded.has(shape)) errors.push(`excluded input ${shape}`);
        if (compiled.ordinary.has(shape)) {
            if (count > 3) errors.push(`ordinary input ${shape} exceeds multiplicity 3`);
            if (compiled.ordinary.get(shape) === 'pure') pureTypes += 1;
            if (shape === 'SuSuRuRu') {
                if (instance.track === 'main') errors.push('SuSuRuRu is forbidden for main targets');
                if (targetGroup) errors.push('SuSuRuRu is forbidden with refinement');
            }
            continue;
        }
        const special = compiled.refinement.get(shape);
        if (!special) errors.push(`input ${shape} is not in the catalog`);
        else if (special.group !== targetGroup) errors.push(`refinement input ${shape} does not match target group ${targetGroup ?? 'none'}`);
    }
    if (pureTypes > 1) errors.push('more than one pure shape type is present');
    if (targetGroup) {
        for (const [shape, requirement] of compiled.refinement) {
            const actual = counts.get(shape) ?? 0;
            const expected = requirement.group === targetGroup ? requirement.count : 0;
            if (actual !== expected) errors.push(`refinement ${targetGroup} requires ${shape} x${expected}, found x${actual}`);
        }
    } else {
        for (const shape of compiled.refinement.keys()) if ((counts.get(shape) ?? 0) !== 0) errors.push(`refinement input ${shape} used without target refinement`);
    }
    return { valid: errors.length === 0, errors, targetGroup, counts, compiled };
}

function sameOutputShapes(expected, declared, unordered) {
    if (expected.length !== declared.length) return false;
    if (!unordered) return expected.every((shape, i) => shape === declared[i]?.shape);
    const a = [...expected].sort();
    const b = declared.map(output => output?.shape).sort();
    return a.every((shape, i) => shape === b[i]);
}

export function replayWitness(instance, catalog) {
    const inputValidation = validateInputRules(instance, catalog);
    if (!inputValidation.valid) return { valid: false, phase: 'inputs', errors: inputValidation.errors };
    const errors = [];
    const live = new Map();
    const seen = new Set();
    const initialCounts = new Map();
    const trace = { initial: [], steps: [] };
    for (const [index, token] of (instance.witness?.initial ?? []).entries()) {
        if (!token || !Number.isInteger(token.id) || seen.has(token.id)) { errors.push(`initial ${index}: invalid/duplicate id`); continue; }
        try { assertShape(token.shape, `initial ${index}`); } catch (error) { errors.push(error.message); continue; }
        seen.add(token.id); live.set(token.id, { shape: token.shape, depth: 0 });
        trace.initial.push({ id: token.id, shape: token.shape });
        initialCounts.set(token.shape, (initialCounts.get(token.shape) ?? 0) + 1);
    }
    for (const [shape, count] of initialCounts) {
        const available = inputValidation.counts.get(shape) ?? 0;
        if (count > available) errors.push(`witness initial uses ${shape} x${count}, but only x${available} is available`);
    }
    if (errors.length) return { valid: false, phase: 'initial', errors };

    const preprocessingStepCount = instance.expansion?.preprocessingStepCount;
    let boundaryLive = preprocessingStepCount === 0 ? new Map([...live].map(([id, token]) => [id, token.shape])) : null;

    const config = new ShapeOperationConfig(instance.rules?.maxLayers ?? MAX_LAYERS);
    const opCounts = {};
    for (const [stepIndex, step] of (instance.witness?.steps ?? []).entries()) {
        try {
            const definition = OPERATIONS[step?.operation];
            if (!definition) throw new Error(`unknown operation ${step?.operation}`);
            if (!Array.isArray(step.inputs) || step.inputs.length !== definition.arity) throw new Error(`operation requires ${definition.arity} inputs`);
            if (!Array.isArray(step.outputs)) throw new Error('outputs must be an array');
            const inputIds = new Set(step.inputs);
            if (inputIds.size !== step.inputs.length) throw new Error('same token consumed twice');
            const inputs = step.inputs.map(id => {
                if (!Number.isInteger(id) || !live.has(id)) throw new Error(`input id ${id} is not live`);
                return live.get(id);
            });
            const params = step.params ?? {};
            if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('params must be an object');
            const paramKeys = Object.keys(params);
            if (definition.color) {
                if (paramKeys.length !== 1 || paramKeys[0] !== 'color' || !VALID_COLORS.has(params.color)) throw new Error('exactly one valid color is required');
                if (step.operation === 'Painter' && instance.rules?.cleanPainting === true) {
                    const inputShape = Shape.fromShapeCode(inputs[0].shape);
                    if (inputShape.numLayers !== 1 || !inputShape.layers[0].every(part => UNPAINTABLE_PARTS.includes(part.shape) || part.color === 'u')) {
                        throw new Error('Painter input violates benchmark clean-painting rule');
                    }
                }
            } else if (paramKeys.length) throw new Error('operation accepts no params');
            let expected;
            if (definition.splitter) {
                throw new Error('Splitter is disabled pending a repository decision on throughput success semantics');
            } else {
                const args = inputs.map(input => Shape.fromShapeCode(input.shape));
                const produced = definition.color
                    ? definition.fn(...args, params.color, config)
                    : definition.fn(...args, config);
                expected = produced.filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            }
            if (!sameOutputShapes(expected, step.outputs, definition.unorderedOutputs)) throw new Error(`declared outputs differ: expected ${expected.join(',')}`);
            for (const id of step.inputs) live.delete(id);
            const outputDepth = Math.max(...inputs.map(input => input.depth)) + 1;
            for (const output of step.outputs) {
                if (!output || !Number.isInteger(output.id) || seen.has(output.id)) throw new Error(`invalid/reused output id ${output?.id}`);
                assertShape(output.shape, `step ${stepIndex} output`);
                seen.add(output.id); live.set(output.id, { shape: output.shape, depth: outputDepth });
            }
            trace.steps.push({
                stepIndex,
                operation: step.operation,
                params: Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))),
                inputs: step.inputs.map((id, index) => ({ id, shape: inputs[index].shape })),
                outputs: step.outputs.map(output => ({ id: output.id, shape: output.shape })),
            });
            opCounts[step.operation] = (opCounts[step.operation] ?? 0) + 1;
            if (stepIndex + 1 === preprocessingStepCount) boundaryLive = new Map([...live].map(([id, token]) => [id, token.shape]));
        } catch (error) {
            const message = error instanceof InvalidOperationInputs ? 'invalid operation input combination' : error.message;
            return { valid: false, phase: 'steps', stepIndex, errors: [message] };
        }
    }
    const resultId = instance.witness?.resultId;
    if (!Number.isInteger(resultId) || !live.has(resultId)) return { valid: false, phase: 'result', errors: ['resultId is not live'] };
    const result = live.get(resultId);
    if (result.shape !== instance.target) return { valid: false, phase: 'result', errors: [`result ${result.shape} does not strictly equal target`] };
    const availableInputCount = [...inputValidation.counts.values()].reduce((sum, count) => sum + count, 0);
    const selectedInputCount = [...initialCounts.values()].reduce((sum, count) => sum + count, 0);
    return {
        valid: true,
        phase: 'complete',
        resultId,
        witnessDepth: result.depth,
        operationCount: (instance.witness?.steps ?? []).length,
        operationCounts: opCounts,
        liveWasteCount: live.size - 1,
        unusedAvailableInputCount: availableInputCount - selectedInputCount,
        targetGroup: inputValidation.targetGroup,
        boundaryLive,
        trace,
    };
}

function validateCoreBasisRows(instance, catalog) {
    const errors = [];
    let compiled;
    try { compiled = compileCatalog(catalog); } catch (error) { return [error.message]; }
    const counts = new Map();
    for (const [index, input] of (instance.coreWitnessBasis ?? []).entries()) {
        if (!input || typeof input.shape !== 'string' || !Number.isInteger(input.count) || input.count < 1) {
            errors.push(`coreWitnessBasis ${index}: expected {shape,count>=1}`);
            continue;
        }
        try { assertShape(input.shape, `coreWitnessBasis ${index}`); } catch (error) { errors.push(error.message); }
        counts.set(input.shape, (counts.get(input.shape) ?? 0) + input.count);
    }
    let targetGroup = null;
    try { targetGroup = targetRefinementGroup(instance.target, compiled); } catch (error) { errors.push(error.message); }
    let pureTypes = 0;
    for (const [shape, count] of counts) {
        if (compiled.excluded.has(shape)) errors.push(`core basis contains excluded input ${shape}`);
        const category = compiled.ordinary.get(shape);
        if (category) {
            if (count > 3) errors.push(`core basis ordinary input ${shape} exceeds multiplicity 3`);
            if (category === 'pure') pureTypes += 1;
            if (shape === 'SuSuRuRu' && instance.track === 'main') errors.push('core basis SuSuRuRu is forbidden for main targets');
            if (shape === 'SuSuRuRu' && targetGroup) errors.push('core basis SuSuRuRu is forbidden with refinement');
            continue;
        }
        const refinement = compiled.refinement.get(shape);
        if (!refinement) errors.push(`core basis input ${shape} is not in the catalog`);
        else if (refinement.group !== targetGroup) errors.push(`core basis refinement input ${shape} does not match target group ${targetGroup ?? 'none'}`);
        else if (count > refinement.count) errors.push(`core basis refinement input ${shape} exceeds bundle availability ${refinement.count}`);
    }
    if (pureTypes > 1) errors.push('core basis contains more than one pure shape type');
    return errors;
}

export function validateExpansionMetadata(instance, catalog, replay = replayWitness(instance, catalog), expansionPolicy = null) {
    if (instance.schemaVersion !== 3) return { valid: true, errors: [] };
    const errors = validateCoreBasisRows(instance, catalog);
    let compiled;
    try { compiled = compileCatalog(catalog); } catch (error) { errors.push(error.message); }
    const expansion = instance.expansion ?? {};
    const basis = multisetRows(instance.coreWitnessBasis);
    const available = multisetRows(instance.availableInputs);
    const delta = multisetDelta(basis, available);
    if (canonicalJson(multisetRows(expansion.basisRemoved)) !== canonicalJson(delta.removed)) errors.push('expansion basisRemoved does not match the core/available multiset delta');
    if (canonicalJson(multisetRows(expansion.availableAdded)) !== canonicalJson(delta.added)) errors.push('expansion availableAdded does not match the core/available multiset delta');
    if (expansion.kind === 'additive' && (delta.removed.length || expansion.preprocessingStepCount !== 0)) {
        errors.push('additive expansion may not remove core resources or declare preprocessing steps');
    }
    if (expansion.kind === 'transformative' && (!delta.removed.length || !(expansion.preprocessingStepCount > 0))) {
        errors.push('transformative expansion must remove at least one core resource and contain preprocessing');
    }
    if (expansionPolicy && compiled) {
        if (expansionPolicy.pilotBounds?.maximumAddedOrdinaryMultiplicitySemantics
            !== 'total count of added ordinary input occurrences in the core-to-presented multiset delta') {
            errors.push('expansion policy maximumAddedOrdinaryMultiplicity semantics are unsupported');
        }
        const ordinaryAdded = delta.added
            .filter(({ shape }) => compiled.ordinary.has(shape))
            .reduce((sum, { count }) => sum + count, 0);
        const maximum = expansionPolicy.pilotBounds?.maximumAddedOrdinaryMultiplicity;
        if (!Number.isInteger(maximum) || maximum < 0) errors.push('expansion policy maximumAddedOrdinaryMultiplicity is invalid');
        else if (ordinaryAdded > maximum) errors.push(`expansion adds ${ordinaryAdded} ordinary occurrences, exceeding total added ordinary limit ${maximum}`);
    }
    if (!replay.valid) return { valid: false, errors };
    if (!Number.isInteger(expansion.preprocessingStepCount) || expansion.preprocessingStepCount < 0 || expansion.preprocessingStepCount > instance.witness.steps.length) {
        errors.push('expansion preprocessingStepCount is outside the witness');
        return { valid: false, errors };
    }
    const bridgeIds = expansion.bridgeTokenIds ?? [];
    if (new Set(bridgeIds).size !== bridgeIds.length) errors.push('expansion bridgeTokenIds contains duplicates');
    const boundary = replay.boundaryLive;
    if (!(boundary instanceof Map)) errors.push('expansion preprocessing boundary was not reached');
    else {
        const bridgeRows = [];
        for (const id of bridgeIds) {
            const shape = boundary.get(id);
            if (!shape) errors.push(`expansion bridge token ${id} is not live at the preprocessing boundary`);
            else bridgeRows.push({ shape, count: 1 });
        }
        if (canonicalMultiset(bridgeRows) !== canonicalMultiset(basis)) errors.push('expansion bridge tokens do not exactly reconstruct coreWitnessBasis');

        const allowed = new Set(bridgeIds);
        for (const [offset, step] of instance.witness.steps.slice(expansion.preprocessingStepCount).entries()) {
            for (const id of step.inputs) if (!allowed.has(id)) errors.push(`core construction step ${offset} consumes non-bridge preprocessing token ${id}`);
            for (const id of step.inputs) allowed.delete(id);
            for (const output of step.outputs) allowed.add(output.id);
        }
        if (!allowed.has(instance.witness.resultId)) errors.push('result is not derived solely from the reconstructed core bridge');
    }
    return { valid: errors.length === 0, errors, delta };
}

export function deriveMetadata(instance, replay) {
    const parts = parseParts(instance.target).flat();
    const counts = new Map();
    for (const input of availableInputsFor(instance)) counts.set(input.shape, (counts.get(input.shape) ?? 0) + input.count);
    const maxMultiplicity = Math.max(...counts.values());
    const metadata = {
        witnessDepth: replay.witnessDepth,
        operationCount: replay.operationCount,
        operationCounts: replay.operationCounts,
        cutCount: replay.operationCounts.Cutter ?? 0,
        stackCount: replay.operationCounts.Stacker ?? 0,
        splitCount: replay.operationCounts.Splitter ?? 0,
        inputTypes: counts.size,
        inputMultiplicity: [...counts.values()].reduce((a, b) => a + b, 0),
        maxInputMultiplicity: maxMultiplicity,
        refinementGroup: replay.targetGroup,
        liveWasteCount: replay.liveWasteCount,
        targetLayers: instance.target.split(':').length,
        targetOccupiedParts: parts.filter(part => part.shape !== '-').length,
        structuralTags: [
            instance.target.includes('P-') ? 'pins' : null,
            parts.some(part => part.shape === 'c') ? 'crystals' : null,
            replay.targetGroup ? 'refinement' : 'ordinary-only',
            instance.target.includes('--') ? 'partial-layers' : 'full-layers',
            replay.operationCounts.Cutter ? 'cut-heavy' : null,
            replay.operationCounts.Stacker ? 'stack-heavy' : null,
        ].filter(Boolean),
    };
    if (instance.schemaVersion === 3) {
        const coreCounts = new Map(multisetRows(instance.coreWitnessBasis).map(input => [input.shape, input.count]));
        metadata.coreInputTypes = coreCounts.size;
        metadata.coreInputMultiplicity = [...coreCounts.values()].reduce((a, b) => a + b, 0);
        metadata.unusedAvailableInputCount = replay.unusedAvailableInputCount;
        metadata.environmentExpansionCount = metadata.inputMultiplicity - metadata.coreInputMultiplicity;
    }
    return metadata;
}

function rotateLayerParts(parts, amount) {
    const n = parts.length;
    return parts.map((_, index) => parts[(index - amount + n) % n]);
}

function abstractPart(part) {
    if (part.shape === PART_CODES.NOTHING) return '--';
    if (part.shape === PART_CODES.PIN) return 'P-';
    return `${part.shape}*`;
}

function abstractShape(shapeCode, { rotationInvariant = false } = {}) {
    const layers = parseParts(shapeCode);
    const candidates = (rotationInvariant ? [0, 1, 2, 3] : [0]).map(rotation => layers
        .map(layer => rotateLayerParts(layer, rotation).map(abstractPart).join(''))
        .join(':'));
    return candidates.sort()[0];
}

function shapeLayers(shapeCode) {
    return parseParts(shapeCode).map(layer => layer.map(part => `${part.shape}${part.color}`));
}

function padLayers(layers, length) {
    return Array.from({ length }, (_, layer) => layers[layer] ?? ['--', '--', '--', '--']);
}

function horizontalUnionKind(leftCode, rightCode, outputCode) {
    const left = shapeLayers(leftCode);
    const right = shapeLayers(rightCode);
    const output = shapeLayers(outputCode);
    const layerCount = Math.max(left.length, right.length);
    if (output.length !== layerCount) return false;
    const a = padLayers(left, layerCount);
    const b = padLayers(right, layerCount);
    for (let layer = 0; layer < layerCount; layer++) {
        for (let part = 0; part < 4; part++) {
            if (a[layer][part] !== '--' && b[layer][part] !== '--') return false;
            const expected = a[layer][part] === '--' ? b[layer][part] : a[layer][part];
            if (output[layer][part] !== expected) return false;
        }
    }
    return true;
}

function verticalConcatKind(bottomCode, topCode, outputCode) {
    return [...shapeLayers(bottomCode), ...shapeLayers(topCode)]
        .map(layer => layer.join('')).join(':') === outputCode;
}

function stableTerm(term) {
    if (typeof term === 'string') return term;
    if (term.kind === 'compose') {
        const children = term.children.flatMap(child => child.kind === 'compose' ? child.children : [child]);
        return { kind: 'compose', children: children.map(stableTerm).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
    }
    if (term.kind === 'layers') {
        const children = term.children.flatMap(child => child.kind === 'layers' ? child.children : [child]);
        return { kind: 'layers', children: children.map(stableTerm) };
    }
    const result = { ...term };
    if (result.children) result.children = result.children.map(stableTerm);
    if (result.child) result.child = stableTerm(result.child);
    return result;
}

/**
 * Build a deterministic causal description from the replay-backed result ancestry.
 * Token ids, witness scheduling and generator labels are deliberately absent.
 * Unary transforms which replay proves preserve the complete shape state are
 * transparent.  Preparation chains retain their complete causal source graph.
 * Only Stacker siblings whose concrete states replay identically in both operand
 * orders are treated as commutative; every other input order remains explicit.
 */
export function deriveStructuralFingerprint(instance, replay = null) {
    if (replay && (!replay.valid || !replay.trace)) throw new Error('structural fingerprint requires a valid replay trace');
    const trace = replay?.trace;
    const steps = trace
        ? trace.steps.map(item => ({
            operation: item.operation,
            params: item.params,
            inputs: item.inputs.map(input => input.id),
            outputs: item.outputs.map(output => ({ id: output.id, shape: output.shape })),
        }))
        : (instance.witness?.steps ?? []);
    const initialTokens = trace?.initial ?? instance.witness?.initial ?? [];
    const initial = new Map(initialTokens.map(token => [token.id, token]));
    const producer = new Map();
    for (const [stepIndex, step] of steps.entries()) {
        for (const [outputIndex, output] of (step.outputs ?? []).entries()) {
            producer.set(output.id, { stepIndex, outputIndex, output, step });
        }
    }
    const activeTokens = new Set();
    const activeSteps = new Set();
    const visit = tokenId => {
        if (activeTokens.has(tokenId)) return;
        activeTokens.add(tokenId);
        const madeBy = producer.get(tokenId);
        if (!madeBy) return;
        activeSteps.add(madeBy.stepIndex);
        for (const inputId of madeBy.step.inputs ?? []) visit(inputId);
    };
    visit(instance.witness?.resultId);
    const activeOutputCounts = new Map();
    for (const tokenId of activeTokens) {
        const madeBy = producer.get(tokenId);
        if (madeBy) activeOutputCounts.set(madeBy.stepIndex, (activeOutputCounts.get(madeBy.stepIndex) ?? 0) + 1);
    }
    const tokenFor = tokenId => initial.get(tokenId) ?? producer.get(tokenId)?.output;
    const operationConfig = new ShapeOperationConfig(instance.rules?.maxLayers ?? MAX_LAYERS);
    const isRotation = operation => ['Rotator CW', 'Rotator CCW', 'Rotator 180'].includes(operation);
    const isSemanticIdentity = madeBy => {
        const { step, stepIndex, output } = madeBy;
        if ((step.inputs ?? []).length !== 1 || (activeOutputCounts.get(stepIndex) ?? 0) !== 1) return false;
        return tokenFor(step.inputs[0])?.shape === output.shape;
    };
    const transparentInput = madeBy => {
        if (isRotation(madeBy.step.operation) || isSemanticIdentity(madeBy)) return madeBy.step.inputs[0];
        return null;
    };
    const commutativeHorizontalStack = (step, outputShape) => {
        if (step.operation !== 'Stacker' || step.inputs.length !== 2) return false;
        const left = tokenFor(step.inputs[0])?.shape;
        const right = tokenFor(step.inputs[1])?.shape;
        if (!left || !right || !horizontalUnionKind(left, right, outputShape)) return false;
        try {
            const reversed = stack(Shape.fromShapeCode(right), Shape.fromShapeCode(left), operationConfig)
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            return reversed.length === 1 && reversed[0] === outputShape;
        } catch {
            return false;
        }
    };
    const symmetricSwapperOperands = step => {
        if (step.operation !== 'Swapper' || step.inputs.length !== 2) return false;
        const inputShapes = step.inputs.map(inputId => tokenFor(inputId)?.shape);
        if (inputShapes.some(shape => !shape)) return false;
        const outputMultiset = shapes => shapes
            .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode()).sort();
        try {
            const [left, right] = inputShapes.map(shape => Shape.fromShapeCode(shape));
            const forward = outputMultiset(swapHalves(left, right, operationConfig));
            const reversed = outputMultiset(swapHalves(right, left, operationConfig));
            const declared = (step.outputs ?? []).map(output => output.shape).sort();
            return canonicalJson(forward) === canonicalJson(reversed)
                && canonicalJson(forward) === canonicalJson(declared);
        } catch {
            return false;
        }
    };
    const canonicalSwapperChildren = (step, children) => step.inputs.map((inputId, index) => ({
        inputState: tokenFor(inputId).shape,
        child: stableTerm(children[index]),
    })).sort((left, right) => canonicalJson({
        inputState: left.inputState,
        child: left.child,
    }).localeCompare(canonicalJson({
        inputState: right.inputState,
        child: right.child,
    }))).map(operand => operand.child);
    const effectiveSteps = new Set();
    const memo = new Map();
    const termFor = tokenId => {
        if (memo.has(tokenId)) return memo.get(tokenId);
        const token = initial.get(tokenId) ?? producer.get(tokenId)?.output;
        if (!token) throw new Error(`structural fingerprint: unknown token ${tokenId}`);
        const madeBy = producer.get(tokenId);
        if (!madeBy) {
            const term = { kind: 'source', class: abstractShape(token.shape, { rotationInvariant: true }) };
            memo.set(tokenId, term);
            return term;
        }
        const { step, stepIndex } = madeBy;
        const bypass = transparentInput(madeBy);
        if (bypass !== null) {
            const term = termFor(bypass);
            memo.set(tokenId, term);
            return term;
        }
        if ((step.operation === 'Painter' || step.operation === 'Cutter' || step.operation === 'Half Destroyer')
            && (activeOutputCounts.get(stepIndex) ?? 0) === 1) {
            let rootId = step.inputs[0];
            while (true) {
                const upstream = producer.get(rootId);
                if (!upstream) break;
                const upstreamBypass = transparentInput(upstream);
                if (upstreamBypass !== null) {
                    rootId = upstreamBypass;
                    continue;
                }
                if (!['Painter', 'Cutter', 'Half Destroyer'].includes(upstream.step.operation)
                    || (activeOutputCounts.get(upstream.stepIndex) ?? 0) > 1) break;
                rootId = upstream.step.inputs[0];
            }
            effectiveSteps.add(stepIndex);
            const term = {
                kind: 'prepared-piece',
                state: abstractShape(token.shape, { rotationInvariant: true }),
                source: termFor(rootId),
            };
            memo.set(tokenId, term);
            return term;
        }
        let children = (step.inputs ?? []).map(termFor);
        if (symmetricSwapperOperands(step)) children = canonicalSwapperChildren(step, children);
        let term;
        effectiveSteps.add(stepIndex);
        if (commutativeHorizontalStack(step, token.shape)) term = { kind: 'compose', children };
        else if (step.operation === 'Stacker' && verticalConcatKind(
            tokenFor(step.inputs[0]).shape,
            tokenFor(step.inputs[1]).shape,
            token.shape,
        )) term = { kind: 'layers', children };
        else {
            term = {
                kind: step.operation,
                state: abstractShape(token.shape),
                params: Object.fromEntries(Object.entries(step.params ?? {}).sort(([a], [b]) => a.localeCompare(b))),
                children,
            };
            if ((activeOutputCounts.get(stepIndex) ?? 0) > 1) {
                term.sharedOutputs = (step.outputs ?? []).filter(output => activeTokens.has(output.id))
                    .map(output => abstractShape(output.shape, { rotationInvariant: true })).sort();
            }
        }
        term = stableTerm(term);
        memo.set(tokenId, term);
        return term;
    };
    const representation = stableTerm(termFor(instance.witness?.resultId));
    const canonical = JSON.stringify(representation);
    return {
        version: 'causal-construction-v3',
        representation,
        canonical,
        signature: sha256(canonical),
        activeOperationCount: activeSteps.size,
        effectiveOperationCount: effectiveSteps.size,
        activeTokenCount: activeTokens.size,
    };
}

export function weightedJaccard(signatureA, signatureB) {
    const parse = signature => new Map(signature.split('|').filter(Boolean).map(term => {
        const at = term.lastIndexOf('*'); return [term.slice(0, at), Number(term.slice(at + 1))];
    }));
    const a = parse(signatureA); const b = parse(signatureB);
    const keys = new Set([...a.keys(), ...b.keys()]);
    let intersection = 0; let union = 0;
    for (const key of keys) { intersection += Math.min(a.get(key) ?? 0, b.get(key) ?? 0); union += Math.max(a.get(key) ?? 0, b.get(key) ?? 0); }
    return union ? intersection / union : 1;
}
