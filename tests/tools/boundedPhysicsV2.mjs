import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import { ROOT as rootPath, verifyVersion } from '../../versions/identity.mjs';
const ROOT=rootPath.replaceAll('\\','/'),OUT=path.resolve(process.argv[2]??path.join(ROOT,'docs/physics-v2-release-gate-20261029/evidence')).replaceAll('\\','/');
const identity=await verifyVersion({version:'shape-operations-v2-support-closure'});assert.equal(identity.valid,true,identity.errors.join('\n'));
const model=await import(pathToFileURL(ROOT+'/tests/helpers/independentPhysics.mjs'));
const {probe}=await import(pathToFileURL(ROOT+'/tests/helpers/physicsProbe.mjs'));
const {module: mod}=await probe(ROOT);
globalThis.self={postMessage(){}};
const {shapeSolverTestOnly}=await import(pathToFileURL(ROOT+'/shapeSolver.js'));
const base=JSON.parse(await fs.readFile(OUT+'/acceptance.json','utf8'));
const limits={maxTotalStates:300,maxGeneratedStates:1500,maxInternedShapes:700,maxSearchTimeMs:1500,operationTimeCheckInterval:128};
const names={'Pin Pusher':'pushPin','Cutter':'cut','Half Destroyer':'halfCut','Stacker':'stack','Swapper':'swapHalves','Crystal Generator':'genCrystal','Painter':'topPaint','Rotator CW':'rotate90CW','Rotator CCW':'rotate90CCW','Rotator 180':'rotate180'};
const checked=new Map(),states=new Set(),results=[];let current,gravityCalls=0,cappedOutputEvents=0;
globalThis.__physicsProbe=(stage,layers,support)=>{
 const rows=layers.map(r=>r.map(p=>p.shape+p.color)),code=model.encode(rows);
 if(stage==='first'){current=rows;gravityCalls++;}
 const key=stage+'|'+(stage==='deleted'?model.encode(current)+'|':'')+code;
 if(states.has(key))return;states.add(key);
 if(support)assert.deepEqual(support,model.supportModel(rows));
 else for(const group of model.components(current)){
  const removed=group.filter(([l,q])=>rows[l][q][0]!=='c').length;assert.ok(!removed||removed===group.length);
 }
};
for(const c of base.cases){
 const shapes=new Map();let operationOutputs=0;
 const observer={onEvent(e){
  if(e.type==='shape-birth')shapes.set(e.shapeId,e.code);
  if(e.type==='operation-output'){
   operationOutputs++;
   const inputs=(e.physicalInputShapeIds??e.inputShapeIds).map(id=>shapes.get(id));assert.ok(inputs.every(Boolean));
   const key=JSON.stringify([e.operation,inputs,e.color]);
   if(!checked.has(key)){
    const params=e.color===null?{}:{color:e.color};
    const actual=mod[names[e.operation]](...inputs.map(code=>mod.Shape.fromShapeCode(code)),...(e.color===null?[]:[e.color]),new mod.ShapeOperationConfig(4)).map(s=>s.toShapeCode());
    const expected=model.physicalOutputs(e.operation,inputs,params);
    const norm=a=>e.operation==='Swapper'?[...a].sort():a;
    assert.deepEqual(norm(actual),norm(expected));checked.set(key,actual);
   }
   const actual=checked.get(key).filter(code=>!/^[\-:]+$/.test(code));
   if(e.outputShapeIds!==null){
    const known=new Set(shapes.values()),projected=actual.filter(code=>known.has(code));
    if(projected.length!==actual.length){assert.equal(shapes.size,limits.maxInternedShapes,'only the explicit intern cap may omit an output');cappedOutputEvents++;}
    assert.deepEqual(e.outputShapeIds.map(id=>shapes.get(id)),projected,'event output under the intern cap');
   }
  }
 }};
 const start=performance.now(),result=await shapeSolverTestOnly({...c.input,maxStatesPerLevel:20},{limits,observer});
 results.push({caseId:c.caseId,outcome:result.outcome,limitReason:result.limitReason,statesExplored:result.statesExplored,generatedStates:result.generatedStates,depth:result.depth,operationOutputs,elapsedMs:performance.now()-start});
 if(results.length%30===0)console.log('bounded '+results.length+'/159');
}
delete globalThis.__physicsProbe;
const summary={cases:results.length,uniquePhysicalOperations:checked.size,operationOutputEvents:results.reduce((n,r)=>n+r.operationOutputs,0),supportMismatches:0,partialComponents:0,gravityCalls,uniqueStages:states.size,cappedOutputEvents};
await fs.writeFile(OUT+'/bounded.json',JSON.stringify({semantics:'shape-operations-v2-support-closure',scope:'Bounded fallback only, not public production route and not exhaustive reachability.',limits,maxStatesPerLevel:20,summary,results},null,2));
console.log(JSON.stringify(summary));
