# Target-Conditioned Candidate Generation v1

Verdict: `PROVISIONAL / STOPPED`

Formal comparison baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661` (0/159 solved).

| Configuration | SOLVED | LIMIT | UNSUPPORTED_DOMAIN | EXHAUSTED | Stable solved | Distinct targets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TCG-A strict-subgoal | 2 | 70 | 78 | 9 | 2 | 1 |
| TCG-B progressive-subgoal | 2 | 71 | 78 | 8 | 2 | 1 |

Both configurations solved the same members: `hard-main-001:F1` and `hard-main-001:F2`. Each returned a nine-operation path. Both members solved again in independent fresh processes under the identical configuration, and every first-pass and repeat path was replay-valid.

The architecture therefore demonstrates real but narrow capability progress: stable 2/159 and 1/53 targets versus the baseline's 0/159 and 0/53. It does not satisfy the frozen ACCEPT gate of at least three stable members across at least two targets, so the verdict is PROVISIONAL.

The implementation used only target shape, starting resources, operations, and public rule parameters. Target IDs remained in the parent runner only for result membership. Candidate selection did not receive target IDs, witnesses, construction metadata, structural tags, or benchmark-specific recipes.

Small-domain tests and full regression checks are engineering-correctness gates and do not add capability credit. The experiment is stopped. No third configuration, target-specific adjustment, E-004 evidence extension, or second architecture experiment is authorized.
