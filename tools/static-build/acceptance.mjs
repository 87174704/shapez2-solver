// Heavy correctness acceptance is deliberately opt-in after timing isolation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, readJson, writeJson, sha } from './shared.mjs';
import { verifyRelease } from '../../versions/release1.mjs';
const out=path.join(ROOT,'.f1/acceptance');await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(ROOT,'.f1/tmp'),{recursive:true});
if(process.env.F1_EXCLUSIVE_WINDOW!=='1') {
  await writeJson('.f1/evidence/correctness-validation.json',{status:'BLOCKED',reason:'No confirmed uncontested window; v2 full regressions, 159 Solver cases, historical v1 and witness replay were not run.',phases:[]});
  console.log('BLOCKED: exclusive test window is required.');process.exitCode=2;
}else {
  const result={status:'UNKNOWN',exclusiveWindowConfirmed:true,node:process.version,phases:[]};
  const run=async(name,args)=>{
    const logFile=path.join(out,name+'.log'),log=await fs.open(logFile,'w');
    const child=spawn(process.execPath,args,{cwd:ROOT,env:{...process.env,TEMP:path.join(ROOT,'.f1/tmp'),TMP:path.join(ROOT,'.f1/tmp'),TMPDIR:path.join(ROOT,'.f1/tmp')},stdio:['ignore',log.fd,log.fd]});
    let spawnError;child.on('error',e=>spawnError=e.message);const code=await new Promise(resolve=>child.on('close',resolve));await log.close();
    const text=await fs.readFile(logFile,'utf8');const counts=Object.fromEntries([...text.matchAll(/^# (tests|pass|fail|skipped|cancelled) (\d+)/gm)].map(m=>[m[1],Number(m[2])]));
    const expected=name==='historical-v1'?{tests:198,pass:198,fail:0,skipped:0}:name==='regressions-v2'?{tests:262,pass:249,fail:0,skipped:13}:null;
    const countsMatch=!expected||Object.entries(expected).every(([key,n])=>counts[key]===n),passed=code===0&&countsMatch;
    result.phases.push({name,status:passed?'VERIFIED':'BLOCKED',exitCode:code,spawnError,counts,expectedCounts:expected,countsMatch,log:'.f1/acceptance/'+name+'.log',sha256:sha(text)});console.log(`${name}: ${passed?'VERIFIED':'BLOCKED'}`);await writeJson('.f1/evidence/correctness-validation.json',result);return passed;
  };
  const historical=path.join(out,`historical-v1-${Date.now()}`);
  const historicalOk=await run('historical-v1',['tests/tools/runHistoricalV1.mjs',historical]);
  if(historicalOk)await run('frozen-evidence-v1',['scripts/ci/verify-frozen.mjs',historical]);
  await run('regressions-v2',['--test','--test-reporter=tap']);
  await run('current-solver-159',['tests/tools/verifyBrowserSafeProduction.mjs']);
  for(const file of ['input-lateral.json','input-propagation-controls.json'])await fs.copyFile(path.join(ROOT,'tests/fixtures/physics-v2',file),path.join(out,file));
  if(historicalOk)await run('physics-v2-witnesses',['tests/tools/validatePhysicsV2.mjs',out,historical]);
  result.identity=await verifyRelease();
  result.status=result.phases.length===5&&result.phases.every(p=>p.status==='VERIFIED')&&result.identity.valid?'VERIFIED':'BLOCKED';await writeJson('.f1/evidence/correctness-validation.json',result);console.log(result.status);if(result.status!=='VERIFIED')process.exitCode=1;
}
