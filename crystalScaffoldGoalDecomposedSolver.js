import { Shape, ShapePart, ShapeOperationConfig, genCrystal } from './shapeOperations.js';
import { PART_CODES } from './shapeConstants.js';
import { pinGoalDecomposedSolve, pinGoalDecomposedTestOnly } from './pinGoalDecomposedSolver.js';

const ARCHITECTURE = 'crystal-scaffold-goal-decomposed-constructive-synthesis-v1';

function analyzeCrystalTarget(target) {
    const colors = new Set();
    let crystalCount = 0;
    for (const layer of target.layers) {
        for (const part of layer) {
            if (part.shape === PART_CODES.NOTHING) {
                return { supported: false, reason: 'sparse-crystal-layout' };
            }
            if (part.shape === PART_CODES.PIN) {
                return { supported: false, reason: 'final-pin-crystal-layout' };
            }
            if (part.shape === PART_CODES.CRYSTAL) {
                crystalCount += 1;
                colors.add(part.color);
            }
        }
    }
    if (crystalCount === 0) return { supported: false, reason: 'no-crystal' };
    if (colors.size !== 1) return { supported: false, reason: 'mixed-crystal-colors' };
    const color = [...colors][0];
    const scaffold = new Shape(target.layers.map(layer => layer.map(part => (
        part.shape === PART_CODES.CRYSTAL
            ? new ShapePart(PART_CODES.PIN, PART_CODES.NOTHING)
            : new ShapePart(part.shape, part.color)
    ))));
    return { supported: true, color, scaffoldCode: scaffold.toShapeCode(), crystalCount };
}

function unsupported(limits, started, reason) {
    return {
        architecture: ARCHITECTURE,
        architectureConfig: limits.id,
        component: null,
        solutionPath: null,
        depth: 0,
        statesExplored: 0,
        generatedStates: 0,
        extractionStates: 0,
        matchingTransitions: 0,
        wallMs: performance.now() - started,
        outcome: 'exhausted',
        beamPruned: false,
        architectureStatus: 'unsupported-crystal-layout',
        crystalLayoutReason: reason,
    };
}

function findFinalToken(solutionPath, startingShapeCodes, scaffoldCode) {
    for (let stepIndex = solutionPath.length - 1; stepIndex >= 0; stepIndex -= 1) {
        const step = solutionPath[stepIndex];
        for (let outputIndex = step.outputs.length - 1; outputIndex >= 0; outputIndex -= 1) {
            if (step.outputs[outputIndex].shape === scaffoldCode) return step.outputs[outputIndex].id;
        }
    }
    const inputId = startingShapeCodes.findIndex(code => code === scaffoldCode);
    return inputId >= 0 ? inputId : null;
}

function nextTokenId(solutionPath, startingShapeCodes) {
    let maximum = startingShapeCodes.length - 1;
    for (const step of solutionPath) {
        for (const token of [...step.inputs, ...step.outputs]) maximum = Math.max(maximum, token.id);
    }
    return maximum + 1;
}

/** Experimental architecture; it deliberately accepts only public Solver input. */
export async function crystalScaffoldGoalDecomposedSolve(instance, experimentConfig) {
    const limits = pinGoalDecomposedTestOnly.validateConfig(experimentConfig);
    const started = performance.now();
    const targetCodes = instance.targetShapeCodes ?? [];
    if (targetCodes.length !== 1) return unsupported(limits, started, 'target-cardinality');

    const target = Shape.fromShapeCode(targetCodes[0]);
    const hasCrystal = target.layers.some(layer => layer.some(part => part.shape === PART_CODES.CRYSTAL));
    if (!hasCrystal) {
        const delegated = await pinGoalDecomposedSolve(instance, limits);
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            component: 'pin-gdcs-v1',
        };
    }
    if (instance.allowSplitting || instance.preventWaste || target.numParts !== 4) {
        return unsupported(limits, started, 'unsupported-domain');
    }
    if (!(instance.enabledOperations ?? []).includes('Crystal Generator')) {
        return unsupported(limits, started, 'crystal-generator-disabled');
    }

    const analysis = analyzeCrystalTarget(target);
    if (!analysis.supported) return unsupported(limits, started, analysis.reason);
    const operationConfig = new ShapeOperationConfig(instance.maxLayers ?? 4);
    const generatedCode = genCrystal(
        Shape.fromShapeCode(analysis.scaffoldCode), analysis.color, operationConfig,
    )[0].toShapeCode();
    if (generatedCode !== target.toShapeCode()) {
        return unsupported(limits, started, 'non-exact-crystal-reversal');
    }

    const scaffoldResult = await pinGoalDecomposedSolve({
        ...instance,
        targetShapeCodes: [analysis.scaffoldCode],
    }, limits);
    if (!Array.isArray(scaffoldResult.solutionPath)) {
        return {
            ...scaffoldResult,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            component: 'crystal-scaffold-v1',
            crystalScaffoldCode: analysis.scaffoldCode,
            crystalColor: analysis.color,
            crystalCount: analysis.crystalCount,
            crystalScaffoldStatus: scaffoldResult.architectureStatus,
        };
    }

    const solutionPath = scaffoldResult.solutionPath.map(step => ({
        ...step,
        inputs: step.inputs.map(input => ({ ...input })),
        outputs: step.outputs.map(output => ({ ...output })),
        params: { ...step.params },
    }));
    const scaffoldTokenId = findFinalToken(
        solutionPath, instance.startingShapeCodes ?? [], analysis.scaffoldCode,
    );
    if (scaffoldTokenId === null) {
        return {
            ...scaffoldResult,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            component: 'crystal-scaffold-v1',
            solutionPath: null,
            outcome: 'exhausted',
            architectureStatus: 'construction-failed',
            crystalScaffoldStatus: 'missing-final-scaffold-token',
        };
    }
    solutionPath.push({
        operation: 'Crystal Generator',
        inputs: [{ id: scaffoldTokenId, shape: analysis.scaffoldCode }],
        outputs: [{
            id: nextTokenId(solutionPath, instance.startingShapeCodes ?? []),
            shape: target.toShapeCode(),
        }],
        params: { color: analysis.color },
    });
    if (solutionPath.length > limits.maxOperations) {
        return {
            ...scaffoldResult,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            component: 'crystal-scaffold-v1',
            solutionPath: null,
            depth: solutionPath.length,
            outcome: 'limit',
            limitReached: true,
            limitReason: 'operations',
            architectureStatus: 'limited',
        };
    }
    return {
        ...scaffoldResult,
        architecture: ARCHITECTURE,
        architectureConfig: limits.id,
        component: 'crystal-scaffold-v1',
        solutionPath,
        depth: solutionPath.length,
        wallMs: performance.now() - started,
        outcome: 'solved',
        architectureStatus: 'solved',
        crystalScaffoldCode: analysis.scaffoldCode,
        crystalColor: analysis.color,
        crystalCount: analysis.crystalCount,
    };
}

export const crystalScaffoldGoalDecomposedTestOnly = Object.freeze({
    analyzeCrystalTarget,
    findFinalToken,
    nextTokenId,
});
