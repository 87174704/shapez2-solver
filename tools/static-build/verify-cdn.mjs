import { request, readJson, writeJson } from './shared.mjs';
const lock = await readJson('tools/static-build/resources.lock.json');
const records = [];
for (const d of lock.dependencies) for (const profile of ['global','china']) {
  try { const {record} = await request(d[profile]); records.push({name:d.name,profile,...record,statusLabel:record.sha256 === d.sha256 && record.integrity === d.integrity && record.acao === '*' && /javascript/.test(record.contentType ?? '') ? 'VERIFIED' : 'BLOCKED'}); }
  catch(error) { records.push({name:d.name,profile,url:d[profile],statusLabel:'BLOCKED',...error.record,error:error.message}); }
}
const result = { status: records.every(r=>r.statusLabel === 'VERIFIED') ? 'VERIFIED current-host only' : 'BLOCKED', mainlandReachability: 'UNKNOWN: no independently identified mainland ISP vantage point', records };
await writeJson('.f1/evidence/cdn-validation.json',result); console.log(result.status); if(result.status === 'BLOCKED') process.exitCode=1;
