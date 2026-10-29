import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const born=performance.now(), repo=path.resolve(import.meta.dirname,'../..');
let request=''; for await (const chunk of process.stdin) request+=chunk;
const r=JSON.parse(request);
const cases=JSON.parse(fs.readFileSync(path.join(repo,'docs/strict-orientation-constructive-20261030/measured-cases.json')));
const input=cases.find(c=>c.id===r.caseId).input;
const send=x=>fs.writeSync(1,JSON.stringify(x)+'\n'); let active=false;
globalThis.self={postMessage(message){if(active)send({type:'PROGRESS',message});}};
const moduleRoot=r.algorithm==='rc'?path.join(repo,'.release1/old-rc'):repo;
const {shapeSolver}=await import(pathToFileURL(path.join(moduleRoot,'shapeSolver.js')));
const {replaySolution}=await import('../../tests/helpers/shapeSolverOracle.mjs');
const {replay}=await import('./replay.mjs');
const invoke=p=>shapeSolver(p.targetShapeCodes,p.startingShapeCodes,p.enabledOperations,p.maxLayers,
  p.maxStatesPerLevel,p.preventWaste,p.orientationSensitive,p.allowSplitting,p.cleanPainting);
const warm=performance.now(); for(let i=0;i<3;i++)await invoke(cases.find(c=>c.id==='S2').input);
global.gc?.(); send({type:'START',mode:r.algorithm,warmMs:performance.now()-warm,beforeSearchMs:performance.now()-born});
active=true;const start=performance.now();
try {
  const result=await invoke(input),searchMs=performance.now()-start;active=false;
  send({type:'SEARCH_END',searchMs,peakRssMiB:process.resourceUsage().maxRSS/1024});
  let validation=null,independent=null;
  if(Array.isArray(result.solutionPath)){
    const a=replaySolution(input,result.solutionPath,result),b=replay(input,result.solutionPath);
    validation={valid:a.valid,error:a.error};independent={valid:b.valid,error:b.error??null};
  }
  const status=Array.isArray(result.solutionPath)?validation.valid&&independent.valid?'SOLVED':'INVALID_SOLUTION':result.outcome==='limit'?'RESOURCE_LIMIT':result.outcome??'NOT_FOUND';
  send({type:'RESULT',status,mode:r.algorithm,searchMs,result,validation,independent,
    operationCount:result.solutionPath?.length??null,solverRoute:result.solverRoute??'general-search',
    attempt:result.strictConstructiveAttempt??null,
    pathHash:result.solutionPath?createHash('sha256').update(JSON.stringify(result.solutionPath)).digest('hex'):null});
}catch(e){send({type:'RESULT',status:'ERROR',error:e.stack,searchMs:performance.now()-start});}
