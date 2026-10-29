import json, hashlib, csv
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[json.loads(x) for x in (ROOT/'formal.jsonl').read_text(encoding='utf-8').splitlines()]
ledger=read('validation-ledger.json');identity=read('identity-validation.json')
assert len(rows)==1809
assert len(list((ROOT/'runs/formal').glob('*.json')))==1809
assert ledger['validatedPaths']==1734 and ledger['frozenExactPaths']==1431 and ledger['failures']==[]
assert identity['originalChanges']==[] and identity['patchChanges']==['shapeSolver.js']
assert identity['candidate']['errors']==['runtime: shapeSolver.js hash differs']
assert identity['candidate']['frozenFilesChecked']==461 and identity['baseline']['valid']
for file,expected in identity['source'].items(): assert sha(REPO/file)==expected,file
regression=(ROOT/'regression.log').read_text(encoding='utf-8')
assert 'pass 95' in regression and 'fail 0' in regression
physics=(ROOT/'physics-identity-final.log').read_text(encoding='utf-8')
assert 'pass 42' in physics and 'fail 2' in physics
assert 'PASS:' in (ROOT/'browser-safe-production.log').read_text()
assert 'PASS:' in (ROOT/'browser-worker.log').read_text()
lock=json.loads((REPO/'tests/strict-routing/holdout-lock.json').read_text())
assert sha(REPO/'tests/strict-routing/holdouts.json')==lock['sha256']
assert len(list(csv.DictReader((ROOT/'MEASUREMENTS.csv').open(encoding='utf-8-sig'))))==1809
assert len((ROOT/'ROUTE_LOGS.jsonl').read_text().splitlines())==1809
attempts=[r['attempt'] for r in rows if r.get('attempt')]
assert all(not a['accepted'] or (a['elapsedMs'] < a['budgetMs'] and not a['fallback']) for a in attempts)
reports=['REPORT.md','ROUTING_PATCH.md','CORRECTNESS_VALIDATION.md','PERFORMANCE_COMPARISON.md','HOLDOUT_RESULTS.md','REPRODUCE.md']
for file in reports: assert (ROOT/file).stat().st_size>0
check=dict(status='VERIFIED_LOCAL_NOT_PUBLISHED',rows=1809,validatedPaths=1734,frozenExactPaths=1431,
    regressionPassed=95,physicsIdentityHistoricalPassed=42,physicsIdentityHistoricalExpectedFailures=2,
    expectedIdentityError='runtime: shapeSolver.js hash differs',frozenFilesChecked=461,source=identity['source'],
    originalChanges=[],strictAttempts=len(attempts),strictAccepted=sum(a['accepted'] for a in attempts),
    strictFallback=sum(a['fallback'] for a in attempts),maxAttemptMs=max(a['elapsedMs'] for a in attempts),
    holdoutLockCommit='db25eb4',holdoutSha256=lock['sha256'],defaultFeatureFlag=False,release=False,
    reports=reports,note='Cooperative 50ms construction/replay cutoff; external 2s process deadline. Not a historical RC identity or game certification.')
(ROOT/'FINAL_CHECK.json').write_text(json.dumps(check,indent=2)+'\n',encoding='utf-8')
files=[p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='EVIDENCE_MANIFEST.sha256']
files+=[REPO/'shapeSolver.js',REPO/'constructive/validate-strict-plan.js',REPO/'tests/strict-routing.test.mjs']
files+=list((REPO/'tests/strict-routing').glob('*'))
manifest='\n'.join(f'{sha(p)}  {p.relative_to(REPO).as_posix()}' for p in sorted(files))+'\n'
(ROOT/'EVIDENCE_MANIFEST.sha256').write_text(manifest,encoding='utf-8')
print(json.dumps(check,indent=2))
