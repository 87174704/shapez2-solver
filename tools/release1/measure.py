import json,sys,importlib.util,shutil
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
OUT=REPO/'.release1'/'performance'
OUT.mkdir(parents=True,exist_ok=False)
spec=importlib.util.spec_from_file_location('original_o1_limiter',REPO/'docs/strict-orientation-constructive-20261030/limiter.py')
limiter=importlib.util.module_from_spec(spec);spec.loader.exec_module(limiter)
limiter.ROOT=OUT
# Limiter is the original 768 MiB Windows Job Object / 2-second process monitor.
# Only its worker entry path is rebound through an absolute import wrapper.
(OUT/'worker.mjs').write_text("await import("+json.dumps((REPO/'tools/release1/worker.mjs').as_uri())+");\n",encoding='utf-8')
cases=json.loads((REPO/'docs/strict-orientation-constructive-20261030/measured-cases.json').read_text())
config={'variants':['rc','release1'],'repetitions':3,'wallLimitMs':2000,'memoryLimitMiB':768,'v8HeapMiB':512,'serial':True,'cases':len(cases),'caseIds':[c['id'] for c in cases],'baseline':'ec9cc5cb633d021b6af276565223a392f8329b87','warmupPerFreshProcess':3,'timer':'Original START/SEARCH_END performance.now and 5 ms external process monitor','memory':'Original Windows Job Object PROCESS_MEMORY hard limit; private commit and working set high water marks include warmup/replay'}
(OUT/'config.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
order=0
for rep in range(3):
 for ci,case in enumerate(cases if rep%2==0 else list(reversed(cases))):
  variants=['rc','release1'] if (ci+rep)%2==0 else ['release1','rc']
  for variant in variants:
   order+=1
   row=limiter.run_one(case,variant,2000,'formal',rep+1,order)
   if row['status'] in ['INVALID_SOLUTION','ERROR','MEMORY_LIMIT','STARTUP_TIMEOUT','VALIDATION_TIMEOUT']:
    raise RuntimeError('BLOCKED: '+str(row))
