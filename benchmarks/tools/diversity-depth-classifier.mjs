import { canonicalJson, deriveStructuralFingerprint, sha256 } from './benchmark-core.mjs';

export const DIVERSITY_DEPTH_CLASSIFIER_VERSION = 'causal-depth-audit-v1';
export const TARGET_RELATIVE_DEPTH_POLICY_VERSION = 'target-relative-depth-v2';

const SUPPORT_KINDS = new Set(['Pin Pusher', 'Crystal Generator']);
const ROUTING_KINDS = new Set(['Pin Pusher', 'Crystal Generator', 'Swapper', 'Stacker']);

function childrenOf(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node.children)) return node.children;
    if (node.child) return [node.child];
    return [];
}

function preparationCollapsed(node) {
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return node;
    if (node.kind === 'source' || node.kind === 'prepared-piece') return { kind: 'resource' };
    const result = { kind: node.kind };
    if (node.params && Object.keys(node.params).length) result.params = node.params;
    const children = childrenOf(node).map(preparationCollapsed);
    if (node.kind === 'compose' || node.kind === 'Swapper') {
        children.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    }
    if (children.length) result.children = children;
    return result;
}

function supportCollapsed(node) {
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return node;
    if (node.kind === 'source') return { kind: 'resource', state: node.class };
    if (node.kind === 'prepared-piece') return { kind: 'resource', state: node.state };
    const result = { kind: node.kind };
    if (node.state) result.state = node.state;
    const children = childrenOf(node).map(supportCollapsed);
    if (node.kind === 'compose' || node.kind === 'Swapper') {
        children.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    }
    if (children.length) result.children = children;
    return result;
}

function operationTrace(node, accepted = ROUTING_KINDS, result = []) {
    if (!node || typeof node !== 'object') return result;
    for (const child of childrenOf(node)) operationTrace(child, accepted, result);
    if (accepted.has(node.kind)) result.push(node.kind);
    return result;
}

function supportContexts(node, path = 'result', result = []) {
    if (!node || typeof node !== 'object') return result;
    if (SUPPORT_KINDS.has(node.kind)) {
        result.push({
            path,
            kind: node.kind,
            childSkeleton: childrenOf(node).map(supportCollapsed),
            state: node.state ?? null,
        });
    }
    childrenOf(node).forEach((child, index) => supportContexts(child, `${path}.children[${index}]`, result));
    return result;
}

function canonicalSupportContexts(node) {
    return supportContexts(node).map(({ path, ...context }) => context)
        .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
}

function firstDivergence(left, right, path = 'result') {
    if (canonicalJson(left) === canonicalJson(right)) return null;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
        return { path, baselineNode: left?.kind ?? typeof left, candidateNode: right?.kind ?? typeof right };
    }
    if (left.kind !== right.kind) return { path, baselineNode: left.kind, candidateNode: right.kind };
    const a = childrenOf(left);
    const b = childrenOf(right);
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index++) {
        const child = firstDivergence(a[index], b[index], `${path}.children[${index}]`);
        if (child) return child;
    }
    if (a.length !== b.length) {
        return { path, baselineNode: `${left.kind}/${a.length}`, candidateNode: `${right.kind}/${b.length}` };
    }
    return { path, baselineNode: left.kind, candidateNode: right.kind };
}

function subtreeIndex(node, path = 'result', result = new Map()) {
    if (!node || typeof node !== 'object') return result;
    const canonical = canonicalJson(node);
    const key = sha256(canonical);
    const previous = result.get(key);
    if (!previous || canonical.length > previous.size) result.set(key, { path, size: canonical.length, kind: node.kind });
    childrenOf(node).forEach((child, index) => subtreeIndex(child, `${path}.children[${index}]`, result));
    return result;
}

function largestRejoin(left, right) {
    const a = subtreeIndex(left);
    const b = subtreeIndex(right);
    let best = null;
    for (const [key, leftNode] of a) {
        const rightNode = b.get(key);
        if (!rightNode || leftNode.kind === 'source') continue;
        if (!best || leftNode.size > best.size) best = { key, size: leftNode.size, leftNode, rightNode };
    }
    return best ? {
        subtreeSignature: best.key,
        baselinePath: best.leftNode.path,
        candidatePath: best.rightNode.path,
        nodeKind: best.leftNode.kind,
    } : null;
}

function rotateAbstractState(state, rotation, { materialNormalized = true } = {}) {
    if (typeof state !== 'string' || !state.includes(':') && state.length !== 8) return state;
    const layers = state.split(':').map(layer => {
        const parts = [];
        for (let index = 0; index < layer.length; index += 2) {
            const shape = layer[index];
            const color = layer[index + 1];
            let normalizedShape = shape;
            let normalizedColor = color;
            if (materialNormalized) {
                if (shape === '-') { normalizedShape = '-'; normalizedColor = '-'; }
                else if (shape === 'P') { normalizedShape = 'P'; normalizedColor = '-'; }
                else if (shape === 'c') { normalizedShape = 'c'; normalizedColor = '*'; }
                else { normalizedShape = 'S'; normalizedColor = '*'; }
            }
            parts.push(`${normalizedShape}${normalizedColor}`);
        }
        return parts.map((_, index) => parts[(index - rotation + parts.length) % parts.length]).join('');
    });
    return layers.join(':');
}

function normalizedNode(node, rotation, mode) {
    if (!node || typeof node !== 'object') return node;
    if (node.kind === 'source' || node.kind === 'prepared-piece') {
        return { kind: 'resource' };
    }
    const routing = ROUTING_KINDS.has(node.kind);
    const support = SUPPORT_KINDS.has(node.kind);
    let children = childrenOf(node).map(child => normalizedNode(child, rotation, mode));
    if (node.kind === 'compose' || node.kind === 'Swapper') {
        children.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    }
    if (mode === 'transition' && !routing) {
        if (!children.length) return { kind: 'resource' };
        if (children.length === 1) return children[0];
        return { kind: node.kind === 'layers' ? 'layers' : 'join', children };
    }
    if (mode === 'support' && !support) {
        if (!children.length) return { kind: 'resource' };
        if (children.length === 1) return children[0];
        return { kind: node.kind === 'layers' ? 'layers' : 'join', children };
    }
    const result = { kind: node.kind };
    if (node.state && mode !== 'transition') result.occupancy = rotateAbstractState(node.state, rotation);
    if (children.length) result.children = children;
    return result;
}

function rotationNormalizedView(node, mode) {
    const candidates = [0, 1, 2, 3].map(rotation => normalizedNode(node, rotation, mode));
    candidates.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    return candidates[0];
}

function viewEvidence(baselineRepresentation, candidateRepresentation, mode) {
    const baseline = rotationNormalizedView(baselineRepresentation, mode);
    const candidate = rotationNormalizedView(candidateRepresentation, mode);
    return {
        baseline,
        candidate,
        baselineSignature: sha256(canonicalJson(baseline)),
        candidateSignature: sha256(canonicalJson(candidate)),
        isomorphic: canonicalJson(baseline) === canonicalJson(candidate),
    };
}

/**
 * Frozen final-audit policy.  This intentionally sits above
 * causal-construction-v3: structural identity remains byte-for-byte unchanged,
 * while depth acceptance additionally ignores whole-graph rotation and
 * equivalent source/scaffold material.
 */
export function classifyTargetRelativeDepth(baselineInstance, baselineReplay, candidateInstance, candidateReplay) {
    if (!baselineReplay?.valid || !candidateReplay?.valid) {
        throw new Error('target-relative depth classification requires two replay-valid witnesses');
    }
    const baseline = deriveStructuralFingerprint(baselineInstance, baselineReplay);
    const candidate = deriveStructuralFingerprint(candidateInstance, candidateReplay);
    const assembly = viewEvidence(baseline.representation, candidate.representation, 'assembly');
    const support = viewEvidence(baseline.representation, candidate.representation, 'support');
    const transition = viewEvidence(baseline.representation, candidate.representation, 'transition');
    const baselineRouting = operationTrace(baseline.representation);
    const candidateRouting = operationTrace(candidate.representation);
    const routingInventoryChanged = canonicalJson(baselineRouting) !== canonicalJson(candidateRouting);
    const rotationMaterialAlias = assembly.isomorphic && support.isomorphic && transition.isomorphic;
    let level;
    let rationale;
    if (baseline.signature === candidate.signature) {
        level = 'A';
        rationale = 'canonical causal construction is identical';
    } else if (rotationMaterialAlias) {
        level = 'B';
        rationale = 'structural novelty collapses after whole-graph rotation and source/material normalization';
    } else if (routingInventoryChanged || !transition.isomorphic) {
        level = 'E';
        rationale = 'rotation-normalized mechanism/state-transition route differs';
    } else if (!support.isomorphic) {
        level = 'D';
        rationale = 'material-normalized support occupancy, scaffold partition, or support ancestry differs';
    } else if (!assembly.isomorphic) {
        level = 'C';
        rationale = 'rotation-normalized component partition or assembly topology differs';
    } else {
        level = 'B';
        rationale = 'difference is confined to source/material preparation';
    }
    return {
        policyVersion: TARGET_RELATIVE_DEPTH_POLICY_VERSION,
        level,
        rationale,
        baselineSignature: baseline.signature,
        candidateSignature: candidate.signature,
        rotationMaterialAlias,
        normalizedEvidence: {
            assembly: {
                baselineSignature: assembly.baselineSignature,
                candidateSignature: assembly.candidateSignature,
                isomorphic: assembly.isomorphic,
            },
            support: {
                baselineSignature: support.baselineSignature,
                candidateSignature: support.candidateSignature,
                isomorphic: support.isomorphic,
            },
            stateTransition: {
                baselineSignature: transition.baselineSignature,
                candidateSignature: transition.candidateSignature,
                isomorphic: transition.isomorphic,
            },
            routingInventoryChanged,
        },
        earliestSubstantiveDivergence: firstDivergence(assembly.baseline, assembly.candidate),
        rejoinPoint: largestRejoin(assembly.baseline, assembly.candidate),
        baselineRouting,
        candidateRouting,
    };
}

/** Classify only replay-backed causal graphs. Generator labels are ignored. */
export function classifyDiversityDepth(baselineInstance, baselineReplay, candidateInstance, candidateReplay) {
    if (!baselineReplay?.valid || !candidateReplay?.valid) {
        throw new Error('depth classification requires two replay-valid witnesses');
    }
    const baseline = deriveStructuralFingerprint(baselineInstance, baselineReplay);
    const candidate = deriveStructuralFingerprint(candidateInstance, candidateReplay);
    const baselineCore = preparationCollapsed(baseline.representation);
    const candidateCore = preparationCollapsed(candidate.representation);
    const mainCoreTailRemainsIdentical = canonicalJson(baselineCore) === canonicalJson(candidateCore);
    const baselineRouting = operationTrace(baseline.representation);
    const candidateRouting = operationTrace(candidate.representation);
    const baselineTransitions = operationTrace(baseline.representation, SUPPORT_KINDS);
    const candidateTransitions = operationTrace(candidate.representation, SUPPORT_KINDS);
    const supportChanged = canonicalJson(canonicalSupportContexts(baseline.representation))
        !== canonicalJson(canonicalSupportContexts(candidate.representation));
    let level;
    let rationale;
    if (baseline.signature === candidate.signature) {
        level = 'A';
        rationale = 'canonical causal construction is identical';
    } else if (canonicalJson(baselineTransitions) !== canonicalJson(candidateTransitions)
        || (baselineRouting.includes('Swapper') !== candidateRouting.includes('Swapper'))
        || (baselineRouting.includes('Stacker') !== candidateRouting.includes('Stacker'))) {
        level = 'E';
        rationale = 'replay-backed mechanism/state-transition routing differs';
    } else if (supportChanged && (baselineTransitions.length || candidateTransitions.length)) {
        level = 'D';
        rationale = 'Pin/Crystal support or scaffold ancestry differs while the transition inventory is retained';
    } else if (mainCoreTailRemainsIdentical) {
        level = 'B';
        rationale = 'resource preparation differs but the normalized core construction tail is identical';
    } else {
        level = 'C';
        rationale = 'component partition or merge DAG differs beyond resource preparation';
    }
    return {
        level,
        rationale,
        baselineSignature: baseline.signature,
        candidateSignature: candidate.signature,
        earliestSubstantiveDivergence: firstDivergence(baselineCore, candidateCore),
        rejoinPoint: largestRejoin(baselineCore, candidateCore),
        mainCoreTailRemainsIdentical,
        baselineRouting,
        candidateRouting,
    };
}
