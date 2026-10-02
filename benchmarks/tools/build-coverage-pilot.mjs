import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactInstancesHash, canonicalMultiset, compileCatalog, deriveMetadata, deriveStructuralFingerprint,
    instanceContentHash, parseParts, readJson, refinementBundleForTarget, replayWitness,
} from './benchmark-core.mjs';
import {
    GENERATION_FRAMEWORK_VERSION, OrdinaryAtomAllocator, STRATEGY_CAPABILITIES,
    WitnessBuilder, combineDisjoint, consolidateAvailableInputs, partitionIntoColumns,
    rotateColumnToQuadrant, selectColumn, stackLayers,
} from './generation-framework.mjs';
import { ROOT, fileSha256, loadRepositoryPolicy } from './repository-policy.mjs';

export const COVERAGE_RELEASE_ID = 'hard-coverage-pilot-v1';
export const COVERAGE_TARGET_IDS = Object.freeze([
    'hard-main-004',
    'hard-main-010',
    'hard-side-021',
    'hard-side-039',
    'hard-side-041',
]);

function firstPart(code) {
    return parseParts(code).flat().find(part => part.shape !== '-');
}

function takeRefinementColumn(builder, pools, type, color, quadrant) {
    const key = `${type}${color}`;
    const ids = pools.get(key) ?? [];
    if (!ids.length) throw new Error(`refinement occurrence exhausted for ${key}`);
    return rotateColumnToQuadrant(builder, ids.shift(), quadrant);
}

function buildRefinementPools(builder, bundle) {
    const pools = new Map();
    for (const { shape } of bundle.inputs) {
        const columns = partitionIntoColumns(builder, builder.input(shape));
        for (const id of columns) {
            const part = firstPart(builder.shape(id));
            const key = `${part.shape}${part.color}`;
            const ids = pools.get(key) ?? [];
            ids.push(id);
            pools.set(key, ids);
        }
    }
    return pools;
}

function buildMain004(builder, catalog) {
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'main' });
    const bottom = allocator.layer('--SmSm--');
    const middle = allocator.layer('SrRmRmCm');
    let top = builder.input('CuCu----');
    top = builder.operate('Painter', [top], { color: 'w' })[0];
    top = builder.operate('Rotator 180', [top])[0];
    if (builder.shape(top) !== '----CwCw') throw new Error('catalog half-chunk construction mismatch');
    return stackLayers(builder, [bottom, middle, top]);
}

function buildMain010(builder, catalog, bundle) {
    const pools = buildRefinementPools(builder, bundle);
    const solidColumns = [];
    for (const [quadrant, layers] of [
        [0, [['X', 'y'], ['X', 'm']]],
        [2, [['X', 'y'], ['X', 'm']]],
        [3, [['X', 'c'], ['X', 'c']]],
    ]) {
        const ids = layers.map(([type, color]) => takeRefinementColumn(builder, pools, type, color, quadrant));
        solidColumns.push(stackLayers(builder, ids));
    }

    const scaffoldLayers = [];
    for (let occurrence = 0; occurrence < 3; occurrence++) {
        let id = builder.input('CuSu--Cu');
        for (let turns = 0; turns < 4; turns++) {
            const parts = parseParts(builder.shape(id))[0];
            if (parts[1].shape === '-' && parts.filter(part => part.shape !== '-').length === 3) break;
            id = builder.operate('Rotator CW', [id])[0];
        }
        scaffoldLayers.push(id);
    }
    let scaffold = stackLayers(builder, scaffoldLayers);
    scaffold = builder.operate('Crystal Generator', [scaffold], { color: 'r' })[0];
    const columns = partitionIntoColumns(builder, scaffold);
    let crystal = selectColumn(builder, columns, code => {
        const occupied = parseParts(code).flat().filter(part => part.shape !== '-');
        return occupied.length === 3 && occupied.every(part => part.shape === 'c');
    }, 'three-layer red Crystal');
    crystal = rotateColumnToQuadrant(builder, crystal, 1);
    const result = combineDisjoint(builder, [crystal, ...solidColumns]);
    if (builder.shape(result) !== 'XycrXyXc:XmcrXmXc:--cr----') throw new Error(`non-uniform Crystal result mismatch: ${builder.shape(result)}`);
    return result;
}

function buildSide039(builder, catalog, bundle) {
    const pools = buildRefinementPools(builder, bundle);
    const refinementLayer = combineDisjoint(builder, [
        takeRefinementColumn(builder, pools, 'X', 'k', 0),
        takeRefinementColumn(builder, pools, 'X', 'w', 1),
        takeRefinementColumn(builder, pools, 'X', 'k', 2),
        takeRefinementColumn(builder, pools, 'X', 'w', 3),
    ]);
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side', refinementGroup: 'C' });
    return stackLayers(builder, [allocator.layer('RwRuRwRu'), refinementLayer, allocator.layer('WwWuWwWu')]);
}

function buildSide041(builder, catalog, bundle) {
    const selectedBundle = [{ ...bundle.inputs[0], count: 1 }];
    const pools = buildRefinementPools(builder, { inputs: selectedBundle });
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side', refinementGroup: 'D' });
    const bottom = allocator.layer('----Ru--');
    const middle = combineDisjoint(builder, [
        allocator.atom({ shape: 'C', color: 'u' }, 0),
        allocator.atom({ shape: 'C', color: 'u' }, 1),
        takeRefinementColumn(builder, pools, 'Y', 'w', 2),
        allocator.atom({ shape: 'C', color: 'u' }, 3),
    ]);
    const top = combineDisjoint(builder, [
        takeRefinementColumn(builder, pools, 'Y', 'k', 0),
        allocator.atom({ shape: 'S', color: 'r' }, 1),
        allocator.atom({ shape: 'W', color: 'u' }, 2),
        allocator.atom({ shape: 'S', color: 'r' }, 3),
    ]);
    return stackLayers(builder, [bottom, middle, top]);
}

function buildSide021(builder, catalog) {
    const upperAtoms = [];
    for (const [source, count] of [['RuCuWuCu', 3], ['CuWuSuCu', 1]]) {
        for (let occurrence = 0; occurrence < count; occurrence++) {
            const columns = partitionIntoColumns(builder, builder.input(source));
            for (const id of columns) if (firstPart(builder.shape(id)).shape === 'C') upperAtoms.push(id);
        }
    }
    if (upperAtoms.length !== 8) throw new Error(`expected eight shared-occurrence C atoms, found ${upperAtoms.length}`);
    const layers = [];
    for (const [offset, color] of [[0, 'b'], [4, 'w']]) {
        const ids = [];
        for (let quadrant = 0; quadrant < 4; quadrant++) {
            let id = rotateColumnToQuadrant(builder, upperAtoms[offset + quadrant], quadrant);
            id = builder.operate('Painter', [id], { color })[0];
            ids.push(id);
        }
        layers.push(combineDisjoint(builder, ids));
    }
    let pinnedUpper = stackLayers(builder, layers);
    pinnedUpper = builder.operate('Pin Pusher', [pinnedUpper])[0];
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side' });
    const bottom = allocator.layer('CyCwCwCy');
    return builder.operate('Stacker', [bottom, pinnedUpper])[0];
}

const BUILDERS = Object.freeze({
    'hard-main-004': { strategy: 'catalog-half-chunk+multi-stage-stack', build: buildMain004 },
    'hard-main-010': { strategy: 'crystal-scaffold-extraction+shared-refinement', build: buildMain010 },
    'hard-side-021': { strategy: 'shared-occurrence-pin-subassembly', build: buildSide021 },
    'hard-side-039': { strategy: 'shared-refinement-byproduct-reuse', build: buildSide039 },
    'hard-side-041': { strategy: 'partial-refinement-occurrence-reuse', build: buildSide041 },
});

async function provenance(policy, targetCase) {
    return {
        releaseId: COVERAGE_RELEASE_ID,
        generatorVersion: GENERATION_FRAMEWORK_VERSION,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-coverage-pilot.mjs'),
        targetSha256: targetCase.sha256,
        officialTargetsSha256: policy.officialTargets.manifest.sha256,
        catalogVersion: policy.catalog.version,
        catalogSha256: policy.catalog.sha256,
        inputSeedIdentity: policy.inputSeed.identity,
        inputSeedSha256: policy.inputSeed.sha256,
        gameSemanticsId: policy.gameSemantics.id,
        gameSemanticsSha256: policy.gameSemantics.sha256,
    };
}

export async function buildCoveragePilot({ write = true } = {}) {
    const [catalog, manifest, policy] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
    ]);
    compileCatalog(catalog);
    const instances = [];
    const candidateLog = [];
    for (const targetId of COVERAGE_TARGET_IDS) {
        const targetCase = manifest.cases.find(item => item.id === targetId);
        const definition = BUILDERS[targetId];
        try {
            const builder = new WitnessBuilder(4);
            const bundle = refinementBundleForTarget(targetCase.target, compileCatalog(catalog));
            const resultId = definition.build(builder, catalog, bundle);
            if (builder.shape(resultId) !== targetCase.target) throw new Error(`result ${builder.shape(resultId)} != ${targetCase.target}`);
            const inputs = consolidateAvailableInputs(builder.initial, bundle.inputs);
            const instance = {
                schemaVersion: 2,
                id: `${targetId}-coverage-01`,
                suite: 'hard',
                track: targetCase.track,
                targetId,
                target: targetCase.target,
                partition: 'coverage-pilot',
                inputs,
                rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
                provenance: await provenance(policy, targetCase),
                construction: { strategy: definition.strategy },
                witness: builder.witness(resultId),
            };
            const replay = replayWitness(instance, catalog);
            if (!replay.valid) throw new Error(`forward replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
            instance.difficulty = deriveMetadata(instance, replay);
            const structural = deriveStructuralFingerprint(instance, replay);
            instance.diversity = {
                inputMultisetSignature: canonicalMultiset(inputs),
                structureVersion: structural.version,
                structureSignature: structural.signature,
                classification: 'representative',
                duplicateOf: null,
                maxPriorWeightedJaccard: 0,
            };
            instance.instanceSha256 = instanceContentHash(instance);
            instances.push(instance);
            candidateLog.push({ targetId, strategy: definition.strategy, accepted: true, instanceId: instance.id });
        } catch (error) {
            candidateLog.push({ targetId, strategy: definition.strategy, accepted: false, reason: error.message });
        }
    }
    for (const capability of STRATEGY_CAPABILITIES.filter(item => item.status !== 'implemented')) {
        candidateLog.push({ targetId: null, strategy: capability.id, accepted: false, unsupported: true, reason: capability.reason });
    }
    const artifact = {
        schemaVersion: 2,
        benchmarkInstanceSchemaVersion: 2,
        name: 'hard-coverage-pilot-v1',
        releaseId: COVERAGE_RELEASE_ID,
        suite: 'hard',
        partition: 'coverage-pilot',
        targetIds: COVERAGE_TARGET_IDS,
        candidateCount: candidateLog.length,
        acceptedCount: instances.length,
        rejectedCount: candidateLog.filter(entry => !entry.accepted).length,
        instances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/coverage-pilot/v1');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(candidateLog, null, 2)}\n`);
        await writeFile(path.join(directory, 'capabilities.json'), `${JSON.stringify(STRATEGY_CAPABILITIES, null, 2)}\n`);
    }
    return { artifact, candidateLog, capabilities: STRATEGY_CAPABILITIES };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildCoveragePilot();
    console.log(`coverage pilot: ${result.artifact.acceptedCount}/${COVERAGE_TARGET_IDS.length} constructed`);
    if (result.artifact.acceptedCount !== COVERAGE_TARGET_IDS.length) process.exitCode = 1;
}
