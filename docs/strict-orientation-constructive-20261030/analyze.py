import json, csv, statistics, hashlib
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parent
cases = json.loads((ROOT/'measured-cases.json').read_text())
rows = [json.loads(line) for line in (ROOT/'formal.jsonl').read_text().splitlines()]
config = json.loads((ROOT/'formal-config.json').read_text())
expected = len(cases) * 3 * 3
assert len(rows) == expected, (len(rows), expected)
assert len({(r['caseId'], r['algorithm'], r['repeat']) for r in rows}) == expected
assert not any(r['status'] in ['ERROR', 'INVALID_SOLUTION', 'MEMORY_LIMIT'] for r in rows)
summary = []
for c in cases:
    for alg in config['variants']:
        group = [r for r in rows if r['caseId'] == c['id'] and r['algorithm'] == alg]
        solved = [r for r in group if r['status'] == 'SOLVED']
        times = [r['searchMs'] for r in solved]
        returnedTimes = [r['searchMs'] for r in group if r['status'] != 'TIMEOUT']
        lengths = [r['operationCount'] for r in solved]
        summary.append(dict(caseId=c['id'], source=c['source'], algorithm=alg, solved=len(solved),
            statuses=dict(Counter(r['status'] for r in group)), medianMs=statistics.median(times) if times else None,
            minMs=min(times) if times else None, maxMs=max(times) if times else None,
            returnedMedianMs=statistics.median(returnedTimes) if returnedTimes else None,
            returnedMinMs=min(returnedTimes) if returnedTimes else None, returnedMaxMs=max(returnedTimes) if returnedTimes else None,
            lengths=sorted(set(lengths)), routes=dict(Counter(r.get('solverRoute', 'general-search') for r in group)),
            fallback=sum(bool(r.get('attempt', {}).get('fallback')) for r in group if r.get('attempt')),
            fallbackReasons=dict(Counter(r['attempt']['reason'] for r in group if (r.get('attempt') or {}).get('fallback'))),
            maxCommitMiB=max(r['peakPrivateCommitMiB'] for r in group), maxWorkingSetMiB=max(r['peakWorkingSetMiB'] for r in group)))
def save(name, value): (ROOT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
save('case-summary.json', summary)
fields=['caseId','source','algorithm','repeat','status','searchMs','operationCount','solverRoute','pathHash','fallback','fallbackReason','attemptMs',
    'peakPrivateCommitMiB','peakWorkingSetMiB','processWallMs','startupToStartMs','evidence']
with (ROOT/'MEASUREMENTS.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.DictWriter(f,fields,extrasaction='ignore');writer.writeheader()
    for r in rows:
        attempt=r.get('attempt') or {}
        writer.writerow(dict(r,solverRoute=r.get('solverRoute','general-search'),fallback=attempt.get('fallback',False),
            fallbackReason=attempt.get('reason'),attemptMs=attempt.get('elapsedMs')))
with (ROOT/'ROUTE_LOGS.jsonl').open('w',encoding='utf-8') as f:
    for r in rows:
        item={k:r.get(k) for k in ['caseId','algorithm','repeat','status','searchMs','attempt','evidence']}
        item['solverRoute']=r.get('solverRoute','general-search')
        item['routeBasis']='returned result' if r.get('solverRoute') else 'general core progress + unchanged strict gate'
        if r['status']=='TIMEOUT':
            trace=ROOT/r['evidence'].replace('.json','.stdout.jsonl')
            progress=[json.loads(x) for x in trace.read_text().splitlines()]
            assert any(x.get('message',{}).get('messageKey')=='solver.status.progress' for x in progress),r['evidence']
        f.write(json.dumps(item,ensure_ascii=False)+'\n')
parity=[]
for c in cases:
    for rep in range(1,4):
        rc=next(r for r in rows if r['caseId']==c['id'] and r['algorithm']=='rc' and r['repeat']==rep)
        off=next(r for r in rows if r['caseId']==c['id'] and r['algorithm']=='off' and r['repeat']==rep)
        # A timeout has no final path to compare. Never equate two censored paths.
        assert rc['status']==off['status'], (c['id'],rc['status'],off['status'])
        complete=rc['status']!='TIMEOUT'
        if complete:
            assert rc.get('pathHash')==off.get('pathHash'), c['id']
            a=json.loads((ROOT/rc['evidence']).read_text())['result']
            b=json.loads((ROOT/off['evidence']).read_text())['result']
            assert {k:v for k,v in a.items() if k!='wallMs'}=={k:v for k,v in b.items() if k!='wallMs'}, c['id']
        parity.append(dict(caseId=c['id'],repeat=rep,complete=complete,exactDeterministicResult=complete,
            excludedTimingFields=['wallMs'], status=rc['status'],
            meaning='identical path and non-timing result' if complete else 'both censored; final path unknown'))
save('off-rc-parity.json',parity)
aggregate=[]
for source in ['new-common-v2','independent-prespecified','frozen-159']:
    for alg in config['variants']:
        group=[r for r in rows if r['source']==source and r['algorithm']==alg]
        solved=[r for r in group if r['status']=='SOLVED']
        aggregate.append(dict(source=source,algorithm=alg,runs=len(group),statuses=dict(Counter(r['status'] for r in group)),
            totalCappedMs=sum(r['searchMs'] for r in group), solvedMedianMs=statistics.median(r['searchMs'] for r in solved),
            maxCommitMiB=max(r['peakPrivateCommitMiB'] for r in group), maxWorkingSetMiB=max(r['peakWorkingSetMiB'] for r in group),
            routes=dict(Counter(r.get('solverRoute','general-search') for r in group)),
            fallback=sum(r.get('attempt',{}).get('fallback',False) for r in group if r.get('attempt'))))
save('aggregate.json',aggregate)
print(json.dumps(aggregate,indent=2))
