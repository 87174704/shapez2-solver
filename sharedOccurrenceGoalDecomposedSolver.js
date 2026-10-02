import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180,
    swapHalves, stack, topPaint, pushPin, genCrystal,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';
import { isolatedPinGoalDecomposedSolve } from './isolatedPinGoalDecomposedSolver.js';
import {
    combineDisjoint, partitionIntoColumns, stackLayers,
} from './constructiveSolverRuntime.js';
import { buildPinSubassembly } from './constructive/pin-construction-planner.js';
import { buildCrystalSubassembly } from './constructive/crystal-construction-planner.js';
import {
    buildMixedPinCrystalSubassembly,
} from './constructive/mixed-pin-crystal-construction-planner.js';

const ARCHITECTURE = 'shared-occurrence-goal-decomposed-constructive-synthesis-v1';
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

class PublicPlanBuilder {
    constructor(instance) {
        this.config = new ShapeOperationConfig(instance.maxLayers ?? 4);
        this.enabled = new Set(instance.enabledOperations ?? []);
        this.startingShapeCodes = [...(instance.startingShapeCodes ?? [])];
        this.live = new Map(this.startingShapeCodes.map((code, id) => [id, code]));
        this.nextId = this.startingShapeCodes.length;
        this.steps = [];
    }

    shape(id) {
        const code = this.live.get(id);
        if (code === undefined) throw new Error(`Token ${id} is not live`);
        return code;
    }

    operate(operation, inputIds, params = {}) {
        if (!this.enabled.has(operation)) throw new Error(`Required operation disabled: ${operation}`);
        const implementation = OPERATION_IMPL[operation];
        if (!implementation) throw new Error(`Unsupported construction operation: ${operation}`);
        const inputCodes = inputIds.map(id => this.shape(id));
        let shapes;
        try {
            shapes = implementation(
                inputCodes.map(code => Shape.fromShapeCode(code)), params, this.config,
            );
        } catch (error) {
            if (error instanceof InvalidOperationInputs) {
                throw new Error(`Invalid construction inputs for ${operation}`);
            }
            throw error;
        }
        const outputs = shapes.filter(shape => !shape.isEmpty()).map(shape => ({
            id: this.nextId++, shape: shape.toShapeCode(),
        }));
        for (const id of inputIds) this.live.delete(id);
        for (const output of outputs) this.live.set(output.id, output.shape);
        this.steps.push({
            operation,
            inputs: inputIds.map((id, index) => ({ id, shape: inputCodes[index] })),
            outputs: outputs.map(output => ({ ...output })),
            params: { ...params },
        });
        return outputs.map(output => output.id);
    }
}

function occupiedCells(code) {
    const shape = Shape.fromShapeCode(code);
    const result = [];
    for (let layer = 0; layer < shape.layers.length; layer += 1) {
        for (let quadrant = 0; quadrant < shape.layers[layer].length; quadrant += 1) {
            const part = shape.layers[layer][quadrant];
            if (part.shape !== PART_CODES.NOTHING) result.push({ layer, quadrant, part });
        }
    }
    return result;
}

function canSupply(part, targetPart, painterEnabled) {
    if (part.shape !== targetPart.shape) return false;
    if (UNPAINTABLE_PARTS.includes(part.shape)) return part.color === targetPart.color;
    if (targetPart.color === UNCOLORED_CODE) return part.color === UNCOLORED_CODE;
    return part.color === targetPart.color || painterEnabled;
}

function rotationOperations(from, to, enabled) {
    const clockwise = (to - from + 4) % 4;
    if (clockwise === 0) return [];
    const choices = [];
    if (enabled.has('Rotator CW')) choices.push(Array(clockwise).fill('Rotator CW'));
    if (enabled.has('Rotator CCW')) choices.push(Array(4 - clockwise).fill('Rotator CCW'));
    if (clockwise === 2 && enabled.has('Rotator 180')) choices.push(['Rotator 180']);
    choices.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return choices[0] ?? null;
}

function buildOrdinary(builder, targetCode, buildPart) {
    const target = Shape.fromShapeCode(targetCode);
    const layers = target.layers.map(parts => combineDisjoint(
        builder,
        parts.map((part, quadrant) => (
            part.shape === PART_CODES.NOTHING ? null : buildPart(part, quadrant)
        )).filter(id => id !== null),
    ));
    return stackLayers(builder, layers);
}

function sharedResourceConstruct(instance, limits, overrides = {}) {
    const started = performance.now();
    const targetCodes = instance.targetShapeCodes ?? [];
    const base = {
        architecture: ARCHITECTURE,
        architectureConfig: limits.id,
        component: 'shared-occurrence-resource-pool-v1',
        solutionPath: null,
        depth: 0,
        statesExplored: 0,
        generatedStates: 0,
        outcome: 'exhausted',
        beamPruned: false,
    };
    if (targetCodes.length !== 1 || instance.allowSplitting || instance.preventWaste) {
        return { ...base, wallMs: performance.now() - started, architectureStatus: 'unsupported-domain' };
    }
    const targetCode = targetCodes[0];
    const target = Shape.fromShapeCode(targetCode);
    if (target.numParts !== 4) {
        return { ...base, wallMs: performance.now() - started, architectureStatus: 'unsupported-domain' };
    }

    const builder = new PublicPlanBuilder(instance);
    const pool = [];
    try {
        for (let inputId = 0; inputId < builder.startingShapeCodes.length; inputId += 1) {
            const columns = partitionIntoColumns(builder, inputId);
            for (const id of columns) {
                const cells = occupiedCells(builder.shape(id));
                if (cells.length !== 1) {
                    throw new Error(`Shared extraction produced non-atomic column ${builder.shape(id)}`);
                }
                pool.push({ id, ...cells[0] });
            }
        }
    } catch (error) {
        return {
            ...base,
            wallMs: performance.now() - started,
            architectureStatus: error.message.startsWith('Required operation disabled:')
                ? 'unsupported-domain' : 'shared-extraction-failed',
            constructionError: error.message,
            partitionOperations: builder.steps.length,
            pooledAtoms: pool.length,
        };
    }

    const remainingNeeds = occupiedCells(targetCode)
        .filter(({ part }) => ![PART_CODES.PIN, PART_CODES.CRYSTAL].includes(part.shape))
        .map(({ part }) => part);
    const painterEnabled = builder.enabled.has('Painter');

    function matchingPossible(atoms, needs) {
        const atomMatch = new Array(atoms.length).fill(-1);
        function augment(needIndex, seen) {
            for (let atomIndex = 0; atomIndex < atoms.length; atomIndex += 1) {
                if (seen.has(atomIndex)
                    || !canSupply(atoms[atomIndex].part, needs[needIndex], painterEnabled)) continue;
                seen.add(atomIndex);
                if (atomMatch[atomIndex] === -1 || augment(atomMatch[atomIndex], seen)) {
                    atomMatch[atomIndex] = needIndex;
                    return true;
                }
            }
            return false;
        }
        const order = needs.map((part, index) => ({ part, index })).sort((a, b) => {
            const aCount = atoms.filter(atom => canSupply(atom.part, a.part, painterEnabled)).length;
            const bCount = atoms.filter(atom => canSupply(atom.part, b.part, painterEnabled)).length;
            return aCount - bCount || a.index - b.index;
        });
        return order.every(({ index }) => augment(index, new Set()));
    }

    function removePoolIndex(index) {
        return pool.splice(index, 1)[0];
    }

    function rotateAtom(atom, quadrant) {
        const sequence = rotationOperations(atom.quadrant, quadrant, builder.enabled);
        if (sequence === null) throw new Error(`Required rotation unavailable for quadrant ${quadrant}`);
        let id = atom.id;
        for (const operation of sequence) id = builder.operate(operation, [id])[0];
        return id;
    }

    function buildPart(part, quadrant) {
        const needIndex = remainingNeeds.findIndex(need => (
            need.shape === part.shape && need.color === part.color
        ));
        const nextNeeds = [...remainingNeeds];
        if (needIndex >= 0) nextNeeds.splice(needIndex, 1);
        const candidates = pool.map((atom, index) => ({ atom, index })).filter(({ atom }) => (
            canSupply(atom.part, part, painterEnabled)
        ));
        candidates.sort((a, b) => (
            Number(a.atom.part.color !== part.color) - Number(b.atom.part.color !== part.color)
            || Number(a.atom.quadrant !== quadrant) - Number(b.atom.quadrant !== quadrant)
            || a.atom.id - b.atom.id
        ));
        const selected = candidates.find(({ index }) => matchingPossible(
            pool.filter((value, candidate) => candidate !== index), nextNeeds,
        ));
        if (!selected) throw new Error(`No shared atom available for ${part.shape}${part.color}`);
        if (needIndex >= 0) remainingNeeds.splice(needIndex, 1);
        const atom = removePoolIndex(selected.index);
        let id = rotateAtom(atom, quadrant);
        const current = occupiedCells(builder.shape(id))[0].part;
        if (current.color !== part.color) {
            if (!painterEnabled || UNPAINTABLE_PARTS.includes(part.shape)
                || part.color === UNCOLORED_CODE) {
                throw new Error(`Unable to finish shared atom ${part.shape}${part.color}`);
            }
            id = builder.operate('Painter', [id], { color: part.color })[0];
        }
        return id;
    }

    function buildSacrificialPart(quadrant) {
        const candidates = pool.map((atom, index) => ({ atom, index })).filter(({ atom }) => (
            ![PART_CODES.PIN, PART_CODES.CRYSTAL].includes(atom.part.shape)
        ));
        candidates.sort((a, b) => (
            Number(UNPAINTABLE_PARTS.includes(a.atom.part.shape))
                - Number(UNPAINTABLE_PARTS.includes(b.atom.part.shape))
            || Number(a.atom.quadrant !== quadrant) - Number(b.atom.quadrant !== quadrant)
            || a.atom.id - b.atom.id
        ));
        const selected = candidates.find(({ index }) => matchingPossible(
            pool.filter((value, candidate) => candidate !== index), remainingNeeds,
        ));
        if (!selected) throw new Error('No surplus shared atom available for sacrificial support');
        return rotateAtom(removePoolIndex(selected.index), quadrant);
    }

    let resultId;
    let planKind;
    try {
        if (!matchingPossible(pool, remainingNeeds)) {
            throw new Error('Shared atom pool cannot cover exact target demands');
        }
        const parts = target.layers.flat();
        const hasPin = parts.some(part => part.shape === PART_CODES.PIN);
        const hasCrystal = parts.some(part => part.shape === PART_CODES.CRYSTAL);
        const options = { buildPart, buildSacrificialPart };
        if (hasPin && hasCrystal) {
            const built = buildMixedPinCrystalSubassembly(builder, targetCode, options);
            resultId = built.resultId;
            planKind = built.plan.kind;
        } else if (hasPin) {
            const built = buildPinSubassembly(builder, targetCode, options);
            resultId = built.resultId;
            planKind = built.plan.kind;
        } else if (hasCrystal) {
            const crystalBuilder = overrides.buildCrystalSubassembly ?? buildCrystalSubassembly;
            const built = crystalBuilder(builder, targetCode, options);
            resultId = built.resultId;
            planKind = built.plan.kind;
        } else {
            resultId = buildOrdinary(builder, targetCode, buildPart);
            planKind = 'ordinary-layer-first';
        }
        if (builder.shape(resultId) !== targetCode) {
            throw new Error(`Shared construction produced ${builder.shape(resultId)} instead of ${targetCode}`);
        }
    } catch (error) {
        return {
            ...base,
            wallMs: performance.now() - started,
            statesExplored: builder.steps.length,
            generatedStates: pool.length,
            architectureStatus: error.message.startsWith('Required operation disabled:')
                ? 'unsupported-domain' : 'shared-resource-construction-failed',
            constructionError: error.message,
            partitionOperations: builder.steps.length,
            pooledAtoms: pool.length,
        };
    }

    if (builder.steps.length > limits.maxOperations) {
        return {
            ...base,
            wallMs: performance.now() - started,
            depth: builder.steps.length,
            statesExplored: builder.steps.length,
            generatedStates: pool.length,
            outcome: 'limit',
            limitReached: true,
            limitReason: 'operations',
            architectureStatus: 'limited',
            partitionOperations: builder.steps.length,
            pooledAtoms: pool.length,
        };
    }
    if (performance.now() - started >= limits.maxWallMs) {
        return {
            ...base,
            wallMs: performance.now() - started,
            statesExplored: builder.steps.length,
            generatedStates: pool.length,
            outcome: 'limit',
            limitReached: true,
            limitReason: 'time',
            architectureStatus: 'limited',
            partitionOperations: builder.steps.length,
            pooledAtoms: pool.length,
        };
    }
    return {
        ...base,
        solutionPath: builder.steps,
        depth: builder.steps.length,
        statesExplored: builder.steps.length,
        generatedStates: pool.length,
        wallMs: performance.now() - started,
        outcome: 'solved',
        architectureStatus: 'solved',
        sharedPlanKind: planKind,
        partitionOperations: builder.steps.length,
        pooledAtoms: pool.length,
        unusedPooledAtoms: pool.length,
    };
}

/** Experimental architecture; it deliberately accepts only public Solver input. */
export async function sharedOccurrenceGoalDecomposedSolve(instance, experimentConfig) {
    const started = performance.now();
    const delegated = await isolatedPinGoalDecomposedSolve(instance, experimentConfig);
    if (delegated.architectureStatus !== 'resource-mismatch') {
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: experimentConfig.id,
            sharedOccurrenceStage: 'delegated-e011',
            delegatedArchitecture: delegated.architecture,
        };
    }
    const result = sharedResourceConstruct(instance, experimentConfig);
    return {
        ...result,
        wallMs: performance.now() - started,
        sharedOccurrenceStage: 'resource-mismatch-fallback',
        delegatedArchitecture: delegated.architecture,
        delegatedStatus: delegated.architectureStatus,
    };
}

export const sharedOccurrenceGoalDecomposedTestOnly = Object.freeze({
    sharedResourceConstruct,
    occupiedCells,
    canSupply,
});
