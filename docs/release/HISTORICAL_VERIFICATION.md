# Independent historical certification (B1)

From the repository, with Node/npm, Git (complete history and the original
`hard-capable-v1` tag), tar, and access to the locked npm dependencies:

```sh
node scripts/ci/verify-history.mjs
```

The entry accepts no alternative refs, manifests, pins, evidence directories or
implementation directories. It reads the existing green Release 1 Git object
`5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17`, rather than current HEAD files.
Its frozen maintenance table selects v1
`0647b8502f75145936faf8fbcde7cf2ab5371f75`; its existing preparer and Release 1
baseline binding select frozen Physics v2
`ec9cc5cb633d021b6af276565223a392f8329b87`.
Git replacement objects are disabled. Missing objects or mismatched original tag,
commit, tree, manifest, blob or working bytes fail certification.

The disposable Release 1 snapshot is the **evidence root**: existing version
index, release pin, manifests, inventory, maintenance table, recovery recipes and
verifiers all come from that fixed Git object. The **implementation roots** are
separate v1 and Physics v2 archives, and the fixed Release 1 snapshot itself.
Existing verification functions keep their original evidence-root semantics;
the implementation-root parameter never supplies replacement trust documents.
Current source, current historical directories and current node_modules are not
inputs. A bare repository containing the objects and original tag is sufficient
when the entry script is copied outside it and executed with that repository as
the working directory. No current checkout or HEAD ancestry is required.

The entry reuses the original preparers, exact-hash newline recovery and
verifiers. It checks all 593 original Git blobs and original working byte hashes,
the eight original commit objects and annotated tag, both frozen version
identities, and the unchanged 781-file Release 1 source identity. It runs the
original v1, frozen Physics v2 and Release 1 regression suites, frozen evidence
checks, and independent Physics v2/Release 1 acceptance (159 exact paths and 331
unique frozen witnesses). Original tamper matrices run as part of those suites;
cross-version implementation substitutions must also fail.
For Physics v2, unchanged original Git blobs also receive their original pinned
working byte representation outside Benchmark directories, because legacy policy
validators bind evidence such as `docs/benchmark/USER_RULES.md` too. Changed v2
implementation blobs are never replaced with v1 source.

Archives, fresh locked dependencies, logs, byte verification outputs and
acceptance results live under one unique OS temporary directory. Normal success
and caught failures remove the directory in `finally`; the terminal receives the
results and cleanup path. Forced process termination or machine failure can
interrupt cleanup. No persistent audit directory, clone, worktree registration,
new identity manifest or project-local historical files are created.

This is an additional historical entry, not a replacement for
[full CI](../../scripts/ci/verify.mjs). Full CI's workflow, phases, current source
checks, documentation/syntax checks, 159-case production check and global/China
static profile gates are unchanged. The historical entry does not certify current
HEAD or build its static profiles. Existing production/build validation still
requires the frozen files in the current checkout. B2 may separately decouple
those consumers and remove duplicate historical work only after preserving all
existing blocking assertions; B1 does not authorize that switch.

This entry is additive because modifying an existing sealed script or document
would violate the unchanged Release 1 source pin. No old file, pin or whitelist
is changed to accommodate it.
