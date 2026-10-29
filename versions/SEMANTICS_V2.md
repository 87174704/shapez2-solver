# shape-operations-v2-support-closure

This is the internal physics implementation identity after the two crystal fixes.
Floor-anchored least support closure replaces path-dependent DFS failure caching.
Unsupported crystals are removed as complete pre-mutation fused components.
The existing operation scheduling, collision, layer truncation and resource rules
remain unchanged. See docs/physics-fix-20261029/ for bounded model evidence.

The v1 rules, policies, validators, benchmark inputs and witnesses are immutable
historical records. They do not certify this implementation. Reusing those inputs
requires independent v2 acceptance bound to the current source and tool hashes.
The legacy benchmark-core GAME_SEMANTICS label describes the historical artifact
schema; it is never used as the current implementation identity.

Full game-version-specific validation is UNKNOWN. This version certifies local
source identity and bounded internal model checks, not complete game equivalence.
No stable performance improvement or regression is claimed.
