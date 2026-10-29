import { verifyRelease } from '../../versions/release1.mjs';
import fs from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT as rootPath, verifyVersion } from '../../versions/identity.mjs';
const ROOT=rootPath.replaceAll('\\','/'),OUT=path.resolve(process.argv[2]??path.join(ROOT,'docs/physics-v2-release-gate-20261029/evidence')).replaceAll('\\','/');
const identity=await verifyRelease();assert.equal(identity.valid,true,identity.errors.join('\n'));
const {probe}=await import(pathToFileURL(ROOT+'/tests/helpers/physicsProbe.mjs'));
const {source}=await probe(ROOT);
const model=await import(pathToFileURL(ROOT+'/tests/helpers/independentPhysics.mjs'));
const physicsURL=pathToFileURL(ROOT+'/shapeOperations.js').href;
registerHooks({load(url,ctx,next){if(url===physicsURL)return {format:'module',source,shortCircuit:true};return next(url,ctx);}});
let calls=0,current,caseId;
const states=new Map(),deletions=new Map(),results=[];
globalThis.__physicsProbe=(stage,layers,support)=>{
 const rows=layers.map(r=>r.map(p=>p.shape+p.color)),code=model.encode(rows);
 if(stage==='first'){calls++;current=rows;}
 if(support){
  const key=stage+'|'+code;
  if(!states.has(key)){
   assert.deepEqual(support,model.supportModel(rows));assert.deepEqual(support,model.supportClosure(rows));
   states.set(key,{stage,code,support:support.map(r=>[...r]),firstCase:caseId});
  }
 }else{
  const key=model.encode(current)+'|'+code;
  if(!deletions.has(key)){
   for(const group of model.components(current)){
    const removed=group.filter(([l,q])=>rows[l][q][0]!=='c').length;
    assert.ok(removed===0||removed===group.length);
   }
   deletions.set(key,{before:model.encode(current),after:code});
  }
 }
};
globalThis.self={postMessage(){}};
const {shapeSolver}=await import(pathToFileURL(ROOT+'/shapeSolver.js'));
const acceptance=JSON.parse(await fs.readFile(OUT+'/acceptance.json','utf8'));
for(const c of acceptance.cases){caseId=c.caseId;const p=c.input;
 const result=await shapeSolver(p.targetShapeCodes,p.startingShapeCodes,p.enabledOperations,4,3000,false,false,false,true);
 assert.deepEqual(result.solutionPath,c.result.solutionPath,'instrumentation changed path');
 results.push({caseId,pathEqual:true});
 if(results.length%30===0)console.log('captured '+results.length+'/159; gravity '+calls);
}
delete globalThis.__physicsProbe;
await fs.writeFile(OUT+'/production-capture.json',JSON.stringify({summary:{cases:results.length,gravityCalls:calls,uniqueSupportStates:states.size,deletionPairs:deletions.size,supportMismatches:0,partialComponents:0,allPathsEqual:true},results,states:[...states.values()],deletions:[...deletions.values()]},null,2));
console.log(JSON.stringify({cases:results.length,calls,states:states.size,deletions:deletions.size}));
