// Current-tree interpretation of the frozen corpus validators.
//
// `npm run bench:validate` already proves that the only permitted historical
// identity difference is a game-semantics file whose working bytes equal the
// currently declared physics pin. This helper reuses that exact classifier so a
// validation-only corpus test can execute in both trees without weakening its
// assertions: in the current tree it removes only the verified deferred pin; in
// the reconstructed v1 tree nothing is deferred and it is the identity function.
//
// Fail-closed: anything that is not in the pre-verified pin set stays an error,
// and every error must be partitioned by the classifier.
import { classifySemanticsErrors, loadSemanticsState } from '../../scripts/bench/validate-corpus.mjs';

const state = await loadSemanticsState();

export const corpusSemanticsMode = state.files.some(file => file.deferred) ? 'deferred' : 'strict';

const deferrable = new Map(corpusSemanticsMode === 'deferred'
    ? state.files.filter(file => file.deferred).map(file => [file.path, file.current])
    : []);

/**
 * Return the validator result with only verified, source-identity-only semantics
 * errors moved out of `errors`. All real corpus, replay, manifest and policy
 * errors remain in `errors`, so callers keep asserting on them unchanged.
 * @param {{valid: boolean, errors?: string[]}} result
 */
export function compatibleValidation(result) {
    const errors = result.errors ?? [];
    const { deferred, blocking } = classifySemanticsErrors(errors, deferrable);
    for (const item of deferred) {
        if (deferrable.get(item.path) !== item.actual) throw new Error(`Unverified deferred semantics: ${item.kind}: ${item.path}`);
    }
    if (deferred.length + blocking.length !== errors.length) {
        throw new Error('Semantics classifier did not partition every validation error');
    }
    // `valid` and `releaseAcceptance` are derived from the complete error set;
    // re-derive them so removing a verified pin cannot leave a false negative
    // behind. Anything blocked stays invalid.
    const valid = blocking.length === 0 && (result.valid || deferred.length > 0);
    const summary = result.summary?.releaseValidationPerformed
        ? { ...result.summary, releaseAcceptance: valid }
        : result.summary;
    return { ...result, valid, summary, errors: blocking, deferredSemantics: deferred };
}
