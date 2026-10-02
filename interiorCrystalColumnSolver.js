import { unsupportedCrystalResourcePoolSolve } from './unsupportedCrystalResourcePoolSolver.js';
import { sharedOccurrenceGoalDecomposedTestOnly } from './sharedOccurrenceGoalDecomposedSolver.js';
import {
    buildInteriorCrystalColumnSubassembly,
} from './constructive/interior-crystal-column-planner.js';

const ARCHITECTURE = 'interior-crystal-column-decomposition-v1';

/** Experimental E-014 architecture. All prior capability delegates unchanged;
 * only the frozen half-scaffold failure enters the generic column topology. */
export async function interiorCrystalColumnSolve(instance, experimentConfig) {
    const started = performance.now();
    const delegated = await unsupportedCrystalResourcePoolSolve(instance, experimentConfig);
    const halfScaffoldFailure = delegated.architectureStatus === 'shared-resource-construction-failed'
        && delegated.constructionError?.includes('no canonical half-scaffold');
    if (!halfScaffoldFailure) {
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: experimentConfig.id,
            interiorCrystalStage: 'delegated-e013',
            delegatedArchitecture: delegated.architecture,
        };
    }

    const result = sharedOccurrenceGoalDecomposedTestOnly.sharedResourceConstruct(
        instance,
        experimentConfig,
        { buildCrystalSubassembly: buildInteriorCrystalColumnSubassembly },
    );
    return {
        ...result,
        architecture: ARCHITECTURE,
        architectureConfig: experimentConfig.id,
        wallMs: performance.now() - started,
        interiorCrystalStage: 'full-height-column-extraction',
        delegatedArchitecture: delegated.architecture,
        delegatedStatus: delegated.architectureStatus,
    };
}

export const interiorCrystalColumnTestOnly = Object.freeze({
    architecture: ARCHITECTURE,
    buildInteriorCrystalColumnSubassembly,
});
