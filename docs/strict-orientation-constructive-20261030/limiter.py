"""Serial fresh-process benchmark with Windows Job Object private commit hard limit.
No solver is instrumented or modified. Each process warms its selected solver first.
"""
import os,sys,json,time,hashlib,subprocess,threading,queue,ctypes,statistics,csv,platform
from pathlib import Path
from ctypes import wintypes as w
ROOT=Path(__file__).resolve().parent
K=ctypes.WinDLL('kernel32',use_last_error=True); P=ctypes.WinDLL('psapi',use_last_error=True)
SIZE=ctypes.c_size_t; ULONG_PTR=SIZE
class BASIC(ctypes.Structure):
 _fields_=[('PerProcessUserTimeLimit',ctypes.c_int64),('PerJobUserTimeLimit',ctypes.c_int64),('LimitFlags',w.DWORD),('MinimumWorkingSetSize',SIZE),('MaximumWorkingSetSize',SIZE),('ActiveProcessLimit',w.DWORD),('Affinity',ULONG_PTR),('PriorityClass',w.DWORD),('SchedulingClass',w.DWORD)]
class IO(ctypes.Structure):
 _fields_=[(x,ctypes.c_uint64) for x in ['ReadOperationCount','WriteOperationCount','OtherOperationCount','ReadTransferCount','WriteTransferCount','OtherTransferCount']]
class EXTENDED(ctypes.Structure):
 _fields_=[('BasicLimitInformation',BASIC),('IoInfo',IO),('ProcessMemoryLimit',SIZE),('JobMemoryLimit',SIZE),('PeakProcessMemoryUsed',SIZE),('PeakJobMemoryUsed',SIZE)]
class MEM(ctypes.Structure):
 _fields_=[('cb',w.DWORD),('PageFaultCount',w.DWORD)]+[(x,SIZE) for x in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
K.CreateJobObjectW.argtypes=[ctypes.c_void_p,w.LPCWSTR];K.CreateJobObjectW.restype=w.HANDLE
K.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD];K.SetInformationJobObject.restype=w.BOOL
K.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];K.AssignProcessToJobObject.restype=w.BOOL
K.QueryInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD,ctypes.c_void_p];K.QueryInformationJobObject.restype=w.BOOL
K.CloseHandle.argtypes=[w.HANDLE];P.GetProcessMemoryInfo.argtypes=[w.HANDLE,ctypes.c_void_p,w.DWORD]
ALGS=['local','default','BFS','IDA*','Bidirectional','Constructive']
def run_one(case,alg,limit_ms,phase,rep,order):
 name=f'{order:04d}_{case["id"]}_{alg.replace("*","star")}'
 folder=ROOT/'runs'/phase;folder.mkdir(parents=True,exist_ok=True)
 start=time.perf_counter();job=K.CreateJobObjectW(None,None);info=EXTENDED();info.BasicLimitInformation.LimitFlags=0x100|0x2000;info.ProcessMemoryLimit=768*1024*1024
 if not job or not K.SetInformationJobObject(job,9,ctypes.byref(info),ctypes.sizeof(info)):raise ctypes.WinError(ctypes.get_last_error())
 proc=subprocess.Popen(['node','--expose-gc','--max-old-space-size=512',str(ROOT/'worker.mjs')],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
 if not K.AssignProcessToJobObject(job,int(proc._handle)):proc.kill();raise ctypes.WinError(ctypes.get_last_error())
 q=queue.Queue();lines=[];errs=[]
 def collect(stream,arr,isout):
  for line in stream:
   arr.append(line)
   if isout:
    try:q.put(json.loads(line))
    except ValueError:pass
 threading.Thread(target=collect,args=(proc.stdout,lines,True),daemon=True).start();threading.Thread(target=collect,args=(proc.stderr,errs,False),daemon=True).start()
 inputhash=hashlib.sha256(json.dumps(case['input'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
 proc.stdin.write(json.dumps({'caseId':case['id'],'algorithm':alg,'inputHash':inputhash}));proc.stdin.close()
 started=None;end=None;result=None;meta={};peakrss=0;peakcommit=0;stop=None
 while True:
  now=time.perf_counter();m=MEM();m.cb=ctypes.sizeof(m)
  if P.GetProcessMemoryInfo(int(proc._handle),ctypes.byref(m),ctypes.sizeof(m)):
   peakrss=max(peakrss,m.PeakWorkingSetSize);peakcommit=max(peakcommit,m.PeakPagefileUsage)
  try:
   msg=q.get(timeout=.005)
   if msg.get('type')=='START':started=time.perf_counter();meta=msg
   elif msg.get('type')=='SEARCH_END':end=msg
   elif msg.get('type')=='RESULT':result=msg
  except queue.Empty:pass
  if result is not None:break
  if started and not end and (now-started)*1000>limit_ms:stop='TIMEOUT';proc.kill();break
  if not started and now-start>20:stop='STARTUP_TIMEOUT';proc.kill();break
  if end and now-start>60:stop='VALIDATION_TIMEOUT';proc.kill();break
  if proc.poll() is not None:
   # Drain already-written final messages before classifying an abnormal exit.
   try:
    while True:
     msg=q.get_nowait()
     if msg.get('type')=='RESULT':result=msg
   except queue.Empty:pass
   break
 proc.wait(timeout=10);total_ms=(time.perf_counter()-start)*1000
 ji=EXTENDED();K.QueryInformationJobObject(job,9,ctypes.byref(ji),ctypes.sizeof(ji),None);peakcommit=max(peakcommit,ji.PeakProcessMemoryUsed);K.CloseHandle(job)
 if result is None:result={'status':stop or ('MEMORY_LIMIT' if peakcommit>700*1024*1024 or any('heap out of memory' in x.lower() for x in errs) else 'ERROR'),'searchMs':limit_ms if stop=='TIMEOUT' else None,'error':''.join(errs)[-3000:]}
 if result.get('searchMs') is not None and result['searchMs']>limit_ms:
  result['returnedStatus']=result['status'];result['status']='TIMEOUT'
 result={**result,'caseId':case['id'],'tier':case['tier'],'source':case['source'],'algorithm':alg,'phase':phase,'repeat':rep,'order':order,'inputHash':inputhash,'wallLimitMs':limit_ms,'memoryLimitMiB':768,'v8HeapLimitMiB':512,'peakWorkingSetMiB':peakrss/1024**2,'peakPrivateCommitMiB':peakcommit/1024**2,'processWallMs':total_ms,'startupToStartMs':(started-start)*1000 if started else None,'exitCode':proc.returncode,'warmup':meta,'searchEnd':end}
 (folder/(name+'.stdout.jsonl')).write_text(''.join(lines),encoding='utf-8');(folder/(name+'.stderr.log')).write_text(''.join(errs),encoding='utf-8');(folder/(name+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 flat={k:v for k,v in result.items() if k not in ['result','validation','secondReplay','externalStepParity','type','warmup','searchEnd']}
 flat['valid']=result.get('validation',{}).get('valid') if result.get('validation') else None
 flat['replayError']=result.get('validation',{}).get('error') if result.get('validation') else None
 flat['evidence']=str((folder/(name+'.json')).relative_to(ROOT))
 with (ROOT/(phase+'.jsonl')).open('a',encoding='utf-8') as f:f.write(json.dumps(flat,ensure_ascii=False)+'\n')
 print(f'{phase} {order} {case["id"]} {alg}: {flat["status"]} {flat.get("searchMs")} ms',flush=True)
 return flat
def main():
 phase=sys.argv[1] if len(sys.argv)>1 else 'pilot';cases=json.loads((ROOT/'measured-cases.json').read_text(encoding='utf-8'))
 if (ROOT/(phase+'.jsonl')).exists():raise RuntimeError('Refuse to overwrite raw run data; use a fresh phase name/directory')
 if phase=='pilot':chosen=[cases[0],next(c for c in cases if c['id']=='S2'),next(c for c in cases if c['id']=='M1'),next(c for c in cases if c['id']=='H1')];reps=1;limit=1000
 elif phase=='formal':chosen=cases;reps=3;limit=2000
 else:raise ValueError(phase)
 config={'phase':phase,'repetitions':reps,'wallLimitMs':limit,'memoryLimitMiB':768,'v8HeapMiB':512,'algorithms':ALGS,'caseIds':[c['id'] for c in chosen],'warmupPerFreshProcess':3,'selectedBeforeThisPhase':True,'serial':True,'python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),'timer':'performance.now in worker + perf_counter hard deadline (5 ms monitor granularity)','memory':'Windows Job Object JOB_OBJECT_LIMIT_PROCESS_MEMORY hard cap; peak private commit queried from job; peak working set via PSAPI','order':'case-interleaved Latin rotation by case/repetition; odd repetitions reverse case order; algorithms rotate and reverse'}
 (ROOT/(phase+'-config.json')).write_text(json.dumps(config,indent=2),encoding='utf-8')
 order=0
 for rep in range(reps):
  for ci,c in enumerate(chosen if rep%2==0 else list(reversed(chosen))):
   shift=(ci+rep)%len(ALGS);algs=ALGS[shift:]+ALGS[:shift]
   if rep%2:algs=list(reversed(algs))
   for alg in algs:order+=1;run_one(c,alg,limit,phase,rep+1,order)
if __name__=='__main__':main()
