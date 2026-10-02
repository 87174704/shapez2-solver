import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    canonicalMultiset, compileCatalog, deriveMetadata, parseParts, readJson,
    refinementBundleForTarget, replayWitness, sha256, weightedJaccard,
} from './benchmark-core.mjs';
import {
    Shape, ShapeOperationConfig, cut, rotate90CW, stack, topPaint, pushPin, genCrystal,
} from '../../shapeOperations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEGACY_BENCHMARK_SCHEMA_VERSION = 1;
const LEGACY_CATALOG_SCHEMA_VERSION = 1;
const LEGACY_GAME_SEMANTICS = 'shapeOperations.js@working-tree';
const PILOT_TARGET_IDS = Object.freeze([
    'hard-side-006',
    'hard-side-007',
    'hard-side-018',
    'hard-side-021',
    'hard-side-035',
]);
const VARIANTS_PER_TARGET = 5;
const MAX_DIVERSITY_SIMILARITY = 0.84;

function mulberry32(seed) {
    return function random() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function hashSeed(value) {
    return Number.parseInt(sha256(value).slice(0, 8), 16);
}

function shuffled(values, random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function applyPath(shapeCode, action) {
    const shape = Shape.fromShapeCode(shapeCode);
    if (action.op === 'Rotator CW') return rotate90CW(shape)[0].toShapeCode();
    return cut(shape)[action.output].toShapeCode();
}

function isolationPath(source, wantedType, wantedIndex, wantedColor = 'u') {
    const wanted = Array.from({ length: 4 }, (_, index) => index === wantedIndex ? `${wantedType}${wantedColor}` : '--').join('');
    const queue = [{ code: source, path: [] }];
    const seen = new Set([source]);
    while (queue.length) {
        const current = queue.shift();
        if (current.code === wanted) return current.path;
        if (current.path.length >= 7) continue;
        const shape = Shape.fromShapeCode(current.code);
        const candidates = [{ op: 'Rotator CW' }];
        const outputs = cut(shape).map(output => output.toShapeCode());
        for (let output = 0; output < outputs.length; output++) candidates.push({ op: 'Cutter', output });
        for (const action of candidates) {
            const code = applyPath(current.code, action);
            if (Shape.fromShapeCode(code).isEmpty() || seen.has(code)) continue;
            seen.add(code); queue.push({ code, path: [...current.path, action] });
        }
    }
    return null;
}

class WitnessBuilder {
    constructor(maxLayers = 4) {
        this.maxLayers = maxLayers;
        this.config = new ShapeOperationConfig(maxLayers);
        this.initial = [];
        this.steps = [];
        this.live = new Map();
        this.nextId = 0;
    }

    input(shape) {
        const id = this.nextId++;
        this.initial.push({ id, shape });
        this.live.set(id, shape);
        return id;
    }

    operate(operation, inputIds, params = {}) {
        const inputs = inputIds.map(id => {
            if (!this.live.has(id)) throw new Error(`builder input ${id} not live`);
            return Shape.fromShapeCode(this.live.get(id));
        });
        let shapes;
        if (operation === 'Rotator CW') shapes = rotate90CW(inputs[0], this.config);
        else if (operation === 'Cutter') shapes = cut(inputs[0], this.config);
        else if (operation === 'Stacker') shapes = stack(inputs[0], inputs[1], this.config);
        else if (operation === 'Painter') shapes = topPaint(inputs[0], params.color, this.config);
        else if (operation === 'Pin Pusher') shapes = pushPin(inputs[0], this.config);
        else if (operation === 'Crystal Generator') shapes = genCrystal(inputs[0], params.color, this.config);
        else throw new Error(`builder operation unsupported: ${operation}`);
        const outputs = shapes.filter(shape => !shape.isEmpty()).map(shape => ({ id: this.nextId++, shape: shape.toShapeCode() }));
        for (const id of inputIds) this.live.delete(id);
        for (const output of outputs) this.live.set(output.id, output.shape);
        this.steps.push({ operation, inputs: inputIds, outputs, params });
        return outputs.map(output => output.id);
    }
}

function consolidateInputs(initial) {
    const counts = new Map();
    for (const token of initial) counts.set(token.shape, (counts.get(token.shape) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([shape, count]) => ({ shape, count }));
}

function combine(builder, ids, mode) {
    if (ids.length === 0) throw new Error('cannot combine no shapes');
    if (ids.length === 1) return ids[0];
    if (mode === 'right') {
        let result = ids.at(-1);
        for (let i = ids.length - 2; i >= 0; i--) result = builder.operate('Stacker', [ids[i], result])[0];
        return result;
    }
    if (mode === 'balanced') {
        let level = [...ids];
        while (level.length > 1) {
            const next = [];
            for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? builder.operate('Stacker', [level[i], level[i + 1]])[0] : level[i]);
            level = next;
        }
        return level[0];
    }
    let result = ids[0];
    for (let i = 1; i < ids.length; i++) result = builder.operate('Stacker', [result, ids[i]])[0];
    return result;
}

function candidateOrdinarySources(catalog, type, targetGroup, track) {
    const compiled = compileCatalog(catalog);
    return [...compiled.ordinary].filter(([shape, category]) => {
        if (category === 'pure') return false;
        if (shape === 'SuSuRuRu' && (track === 'main' || targetGroup)) return false;
        return parseParts(shape)[0].some(part => part.shape === type);
    }).map(([shape]) => shape);
}

export function selectRefinementBundle(target, catalog) {
    return refinementBundleForTarget(target, compileCatalog(catalog));
}

function createInstance(targetCase, catalog, attempt) {
    const random = mulberry32(hashSeed(`${targetCase.id}/${attempt}`));
    const builder = new WitnessBuilder(4);
    const compiled = compileCatalog(catalog);
    const refinementBundle = refinementBundleForTarget(targetCase.target, compiled);
    const targetGroup = refinementBundle.group;
    const useCounts = new Map();
    const refinementIds = new Map();
    if (refinementBundle.group) {
        for (const { shape, count } of refinementBundle.inputs) {
            const ids = [];
            for (let i = 0; i < count; i++) ids.push(builder.input(shape));
            refinementIds.set(shape, ids);
        }
    }

    const modes = ['left', 'balanced', 'right'];
    const atomMode = modes[attempt % modes.length];
    const layerMode = modes[Math.floor(attempt / 3) % modes.length];
    let atomNumber = 0;

    function chooseSource(type) {
        const candidates = shuffled(candidateOrdinarySources(catalog, type, targetGroup, targetCase.track), random)
            .filter(shape => (useCounts.get(shape) ?? 0) < 3);
        if (!candidates.length) throw new Error(`no legal ordinary source for ${type}`);
        const used = candidates.filter(shape => (useCounts.get(shape) ?? 0) > 0);
        const pool = attempt % 2 === 0 && used.length
            ? used
            : candidates.filter(shape => (useCounts.get(shape) ?? 0) === Math.min(...candidates.map(candidate => useCounts.get(candidate) ?? 0)));
        const source = pool[Math.floor(random() * pool.length)];
        useCounts.set(source, (useCounts.get(source) ?? 0) + 1);
        return source;
    }

    function refinedSource(part) {
        const key = `${part.shape}${part.color}`;
        const source = [...refinementIds.keys()].find(shape => parseParts(shape)[0].some(candidate => `${candidate.shape}${candidate.color}` === key));
        if (!source || !refinementIds.get(source).length) throw new Error(`refinement source unavailable for ${key}`);
        return { source, id: refinementIds.get(source).shift() };
    }

    function buildAtom(part, quadrant) {
        const paintBefore = part.color !== 'u' && !['X', 'Y'].includes(part.shape) && ((atomNumber + attempt) % 3 === 0);
        atomNumber += 1;
        let source;
        let current;
        if (['X', 'Y'].includes(part.shape)) {
            ({ source, id: current } = refinedSource(part));
        } else {
            source = chooseSource(part.shape);
            current = builder.input(source);
            if (paintBefore) current = builder.operate('Painter', [current], { color: part.color })[0];
        }
        const path = isolationPath(source, part.shape, quadrant, ['X', 'Y'].includes(part.shape) ? part.color : 'u');
        if (!path) throw new Error(`cannot isolate ${part.shape} at ${quadrant} from ${source}`);
        for (const action of path) {
            const outputs = builder.operate(action.op, [current]);
            current = action.op === 'Cutter' ? outputs[action.output] : outputs[0];
        }
        if (part.color !== 'u' && !paintBefore && !['X', 'Y'].includes(part.shape)) current = builder.operate('Painter', [current], { color: part.color })[0];
        const expected = Array.from({ length: 4 }, (_, index) => index === quadrant ? `${part.shape}${part.color}` : '--').join('');
        if (builder.live.get(current) !== expected) throw new Error(`atom mismatch: ${builder.live.get(current)} != ${expected}`);
        return current;
    }

    function buildLayer(layerCode, layerIndex) {
        const parts = parseParts(layerCode)[0];
        const ids = [];
        for (const [quadrant, part] of parts.entries()) if (part.shape !== '-') ids.push(buildAtom(part, quadrant));
        const id = combine(builder, ids, atomMode === 'balanced' && layerIndex % 2 ? 'right' : atomMode);
        if (builder.live.get(id) !== layerCode) throw new Error(`layer mismatch ${builder.live.get(id)} != ${layerCode}`);
        return id;
    }

    function buildPlain(shapeCode, offset = 0) {
        const layers = shapeCode.split(':');
        const ids = layers.map((layer, index) => buildLayer(layer, index + offset));
        const id = combine(builder, ids, layerMode);
        if (builder.live.get(id) !== shapeCode) throw new Error(`plain shape mismatch ${builder.live.get(id)} != ${shapeCode}`);
        return id;
    }

    const layers = targetCase.target.split(':');
    let resultId;
    const bottomCrystal = parseParts(layers[0])[0];
    const uniformCrystal = bottomCrystal.every(part => part.shape === 'c') && new Set(bottomCrystal.map(part => part.color)).size === 1;
    const upperFull = layers.slice(1).every(layer => parseParts(layer)[0].every(part => !['-', 'P', 'c'].includes(part.shape)));
    const pinIndex = layers.findIndex(layer => parseParts(layer)[0].every(part => part.shape === 'P'));
    if (uniformCrystal && upperFull) {
        resultId = buildPlain(layers.slice(1).join(':'), 1);
        resultId = builder.operate('Pin Pusher', [resultId])[0];
        resultId = builder.operate('Crystal Generator', [resultId], { color: bottomCrystal[0].color })[0];
    } else if (pinIndex >= 0 && layers.slice(pinIndex + 1).length && layers.slice(pinIndex + 1).every(layer => parseParts(layer)[0].every(part => !['-', 'P', 'c'].includes(part.shape)))) {
        let upper = buildPlain(layers.slice(pinIndex + 1).join(':'), pinIndex + 1);
        upper = builder.operate('Pin Pusher', [upper])[0];
        resultId = pinIndex === 0 ? upper : builder.operate('Stacker', [buildPlain(layers.slice(0, pinIndex).join(':')), upper])[0];
    } else {
        resultId = buildPlain(targetCase.target);
    }
    if (builder.live.get(resultId) !== targetCase.target) throw new Error(`final mismatch ${builder.live.get(resultId)} != ${targetCase.target}`);

    const inputs = consolidateInputs(builder.initial);
    const instance = {
        schemaVersion: LEGACY_BENCHMARK_SCHEMA_VERSION,
        id: `${targetCase.id}-pilot-${String(attempt).padStart(3, '0')}`,
        suite: 'hard', track: targetCase.track, targetId: targetCase.id, target: targetCase.target,
        partition: 'pilot',
        inputs,
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        provenance: {
            generator: 'constructive-pilot-v1',
            generatorSeed: `${targetCase.id}/${attempt}`,
            targetSha256: targetCase.sha256,
            sourceCatalogVersion: catalog.version,
            gameSemantics: LEGACY_GAME_SEMANTICS,
        },
        construction: { atomCombine: atomMode, layerCombine: layerMode, strategy: uniformCrystal ? 'crystal-over-pins' : pinIndex >= 0 ? 'pin-subassembly' : 'layer-atoms' },
        witness: { initial: builder.initial, steps: builder.steps, resultId },
    };
    const replay = replayWitness(instance, catalog);
    if (!replay.valid) throw new Error(`self replay failed: ${JSON.stringify(replay)}`);
    instance.difficulty = deriveMetadata(instance, replay);
    instance.instanceSha256 = sha256(JSON.stringify({ target: instance.target, inputs: canonicalMultiset(inputs), witness: instance.witness }));
    return instance;
}

function structureSignature(instance) {
    return `${instance.construction.atomCombine}/${instance.construction.layerCombine}/${instance.construction.strategy}/` +
        instance.witness.steps.map(step => step.operation).join('>');
}

export async function buildPilot({ write = true } = {}) {
    const seedPath = path.join(ROOT, 'benchmarks/sources/input_catalog.seed.json');
    const manifestPath = path.join(ROOT, 'benchmarks/manifest.json');
    const seedText = await import('node:fs/promises').then(fs => fs.readFile(seedPath, 'utf8'));
    const seed = JSON.parse(seedText);
    const catalog = {
        schemaVersion: LEGACY_CATALOG_SCHEMA_VERSION,
        version: seed.version,
        provenance: {
            authority: ['docs/benchmark/USER_RULES.md', 'benchmarks/sources/input_catalog.seed.json'],
            seedSha256: sha256(seedText),
            generatedBy: 'benchmarks/tools/build-pilot.mjs',
        },
        ordinary: seed.ordinary,
        special: seed.special,
        refinement: seed.refinement,
    };
    compileCatalog(catalog);
    const manifest = await readJson(manifestPath);
    const cases = PILOT_TARGET_IDS.map(id => {
        const found = manifest.cases.find(item => item.id === id);
        if (!found) throw new Error(`pilot target missing: ${id}`);
        return found;
    });
    const accepted = [];
    const candidateLog = [];
    for (const targetCase of cases) {
        const targetAccepted = [];
        for (let attempt = 1; attempt <= 400 && targetAccepted.length < VARIANTS_PER_TARGET; attempt++) {
            try {
                const instance = createInstance(targetCase, catalog, attempt);
                const inputSignature = canonicalMultiset(instance.inputs);
                const structure = structureSignature(instance);
                const similarities = targetAccepted.map(other => weightedJaccard(inputSignature, canonicalMultiset(other.inputs)));
                if (targetAccepted.some(other => canonicalMultiset(other.inputs) === inputSignature)) throw new Error('duplicate input multiset');
                if (targetAccepted.some(other => structureSignature(other) === structure)) throw new Error('duplicate construction structure');
                if (similarities.some(value => value > MAX_DIVERSITY_SIMILARITY)) throw new Error(`input similarity exceeds ${MAX_DIVERSITY_SIMILARITY}`);
                instance.id = `${targetCase.id}-pilot-${String(targetAccepted.length + 1).padStart(2, '0')}`;
                instance.diversity = { inputMultisetSignature: inputSignature, structureSignature: sha256(structure), maxPriorWeightedJaccard: similarities.length ? Math.max(...similarities) : 0 };
                targetAccepted.push(instance);
                candidateLog.push({ targetId: targetCase.id, attempt, accepted: true, id: instance.id });
            } catch (error) {
                candidateLog.push({ targetId: targetCase.id, attempt, accepted: false, reason: error.message });
            }
        }
        if (targetAccepted.length !== VARIANTS_PER_TARGET) {
            const recent = candidateLog.filter(entry => entry.targetId === targetCase.id).slice(-5).map(entry => entry.reason).join(' | ');
            throw new Error(`only built ${targetAccepted.length}/${VARIANTS_PER_TARGET} for ${targetCase.id}: ${recent}`);
        }
        accepted.push(...targetAccepted);
    }
    const artifact = {
        schemaVersion: 1,
        benchmarkInstanceSchemaVersion: LEGACY_BENCHMARK_SCHEMA_VERSION,
        name: 'hard-pilot-v1',
        policy: {
            targetCount: cases.length,
            instancesPerTarget: VARIANTS_PER_TARGET,
            maxPairwiseInputWeightedJaccard: MAX_DIVERSITY_SIMILARITY,
            minimumWitnessOperations: 18,
            minimumWitnessDepth: 8,
            allowPureInputs: false
        },
        targetIds: PILOT_TARGET_IDS,
        candidateCount: candidateLog.length,
        acceptedCount: accepted.length,
        rejectedCount: candidateLog.filter(entry => !entry.accepted).length,
        instances: accepted,
    };
    artifact.sha256 = sha256(JSON.stringify(artifact.instances));
    if (write) {
        await mkdir(path.join(ROOT, 'benchmarks/pilot/v1'), { recursive: true });
        await writeFile(path.join(ROOT, 'benchmarks/pilot/v1/instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(ROOT, 'benchmarks/pilot/v1/candidate-log.json'), `${JSON.stringify(candidateLog, null, 2)}\n`);
    }
    return { catalog, artifact, candidateLog };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { artifact } = await buildPilot();
    console.log(`built ${artifact.acceptedCount} accepted pilot instances from ${artifact.candidateCount} candidates (${artifact.sha256})`);
}
