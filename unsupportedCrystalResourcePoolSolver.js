import {
    sharedOccurrenceGoalDecomposedSolve,
    sharedOccurrenceGoalDecomposedTestOnly,
} from './sharedOccurrenceGoalDecomposedSolver.js';

const ARCHITECTURE = 'unsupported-crystal-resource-pool-activation-v1';

/**
 * Experimental architecture. It changes only the entry condition for the
 * frozen E-012 public-resource constructor; the allocator and planners remain
 * unchanged and receive only the public Solver input.
 */
export async function unsupportedCrystalResourcePoolSolve(instance, experimentConfig) {
    const started = performance.now();
    const delegated = await sharedOccurrenceGoalDecomposedSolve(instance, experimentConfig);
    if (delegated.architectureStatus !== 'unsupported-crystal-layout') {
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: experimentConfig.id,
            unsupportedCrystalStage: 'delegated-e012',
            delegatedArchitecture: delegated.architecture,
        };
    }

    const result = sharedOccurrenceGoalDecomposedTestOnly.sharedResourceConstruct(
        instance, experimentConfig,
    );
    return {
        ...result,
        architecture: ARCHITECTURE,
        architectureConfig: experimentConfig.id,
        wallMs: performance.now() - started,
        unsupportedCrystalStage: 'physical-mask-resource-pool',
        delegatedArchitecture: delegated.architecture,
        delegatedStatus: delegated.architectureStatus,
    };
}

export const unsupportedCrystalResourcePoolTestOnly = Object.freeze({
    architecture: ARCHITECTURE,
});
