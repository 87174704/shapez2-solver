import { canonicalJson, sha256 } from './benchmark-core.mjs';

export const COMPOSITE_SCHEMA_VERSION = 4;
export const COMPOSITE_CANONICALIZATION = 'canonical-json-v1';
export const COMPOSITE_RELEASE_ID = 'hard-53x3-stage-v1';
export const COMPOSITE_MANIFEST_REVISION_ID = 'hard-53x3-stage-v1-manifest-r1';
export const FROZEN_FINAL_SELECTION_SHA256 = '6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f';

export function compositeIdentityPayload(manifest) {
    const { compositeCanonicalSha256: _identity, ...payload } = manifest;
    return payload;
}

export function compositeManifestIdentity(manifest) {
    return sha256(canonicalJson(compositeIdentityPayload(manifest)));
}

export function sourceMembers(sourceDocument, contentType) {
    if (contentType === 'benchmark-artifact') return sourceDocument?.instances;
    if (contentType === 'instance-array') return sourceDocument;
    return null;
}

export function memberReferenceFromSelection(slot, sourceId) {
    return {
        targetId: slot.targetId,
        slot: slot.slot,
        familyIdentity: slot.familyIdentity,
        sourceId,
        sourceInstanceId: slot.selectedInstanceId,
        sourceInstanceSha256: slot.selectedInstanceSha256,
        structuralSignature: slot.structuralSignature,
        selectionEntrySha256: sha256(canonicalJson(slot)),
    };
}
