import test from 'node:test';
import { readFileSync } from 'node:fs';
import { sha256 } from '../../versions/identity.mjs';

// These callbacks certify the immutable v1 release, not the current implementation.
// Original unmodified callbacks run in the git-reconstructed v1 tree via test:historical-v1.
// A v2 run must also actively test that the old validator rejects its source identity.
export function historicalV1Test(name, callback) {
    const source = readFileSync(new URL('../../shapeOperations.js', import.meta.url));
    if (sha256(source) === 'c21fc3fcbff818e8c3bb85a84b47d5f975475aab0f6a81bb2e6d59aa66e3eb21') {
        return test(name, callback);
    }
    return test(name, { skip: 'HISTORICAL V1 ONLY; run npm run test:historical-v1; excluded from v2 score' }, callback);
}
