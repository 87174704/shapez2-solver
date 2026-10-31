// Must evaluate before any third-party build package.
import { ROOT } from '../../versions/identity.mjs';
import { verifyCurrentSource, selectedCommit } from '../../versions/current.mjs';
import { verifyDependencies } from './current-dependencies.mjs';
export const sourceIdentity = await verifyCurrentSource({ commit: selectedCommit() });
export const checkedDependencies = await verifyDependencies(ROOT);
