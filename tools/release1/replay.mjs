// Independent analytical physics; no production operation imports.
import { physicalOutputs, transform } from '../../tests/helpers/independentPhysics.mjs';
const nonempty=x=>x.some?x.some(p=>p!=='--'):!/^[-:]+$/.test(x);
export function replay(input,steps){
 const live=new Map(input.startingShapeCodes.map((shape,id)=>[id,shape])),used=new Set(live.keys()),trace=[];
 try{
  if(!Array.isArray(steps))throw Error('No path');
  for(const [index,s]of steps.entries()){
   if(!input.enabledOperations.includes(s.operation))throw Error('disabled operation '+s.operation);
   const arity=['Stacker','Swapper'].includes(s.operation)?2:1;
   if(s.inputs?.length!==arity||!Array.isArray(s.outputs))throw Error('wrong arity');
   const seen=new Set();
   for(const v of s.inputs){if(seen.has(v.id)||live.get(v.id)!==v.shape)throw Error('input is absent, spent or mismatched: '+v.id);seen.add(v.id);}
   if(s.operation==='Painter'&&input.cleanPainting){const rows=s.inputs[0].shape.split(':');if(rows.length!==1||rows[0].match(/../g).some(p=>!['-','P','c','X','Y'].includes(p[0])&&p[1]!=='u'))throw Error('cleanPainting violation');}
   const expected=physicalOutputs(s.operation,s.inputs.map(x=>x.shape),s.params??{},input.maxLayers).filter(nonempty);
   const actual=s.outputs.map(x=>x.shape);
   const ordered=a=>s.operation==='Swapper'?[...a].sort():a;
   if(JSON.stringify(ordered(expected))!==JSON.stringify(ordered(actual)))throw Error('physical output mismatch');
   for(const v of s.inputs)live.delete(v.id);
   for(const v of s.outputs){if(!Number.isInteger(v.id)||used.has(v.id))throw Error('output id reused');used.add(v.id);live.set(v.id,v.shape);}
   trace.push({index,operation:s.operation,inputs:s.inputs,outputs:s.outputs,inventory:[...live].map(([id,shape])=>({id,shape}))});
  }
  const acceptable=new Set([input.targetShapeCodes[0]]);
  if(!input.orientationSensitive)for(let i=1;i<4;i++)acceptable.add(transform(input.targetShapeCodes[0],i));
  if(![...live.values()].some(x=>acceptable.has(x)))throw Error('target absent');
  if(input.preventWaste&&[...live.values()].some(x=>!acceptable.has(x)))throw Error('waste remains');
  return {valid:true,trace,terminal:[...live]};
 }catch(e){return {valid:false,error:e.message,at:trace.length,trace,terminal:[...live]};}
}
