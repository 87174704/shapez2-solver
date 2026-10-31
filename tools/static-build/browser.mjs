import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { ROOT, sha, readJson, writeJson } from './shared.mjs';
import { serve } from './serve.mjs';
await fs.mkdir(path.join(ROOT,'.f1/tmp'),{recursive:true});
const destination = '.f1/evidence/browser-validation.json';
if(process.env.F1_EXCLUSIVE_WINDOW !== '1') {
  await writeJson(destination,{status:'BLOCKED',reason:'No confirmed uncontested window. Browser not launched; external timing agent must remain undisturbed.',profiles:[]});
  console.log('BLOCKED: set F1_EXCLUSIVE_WINDOW=1 only after the exclusive test window is confirmed.');process.exitCode=2;
} else {
  const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome'];
  let executablePath;for(const p of candidates)try{await fs.access(p);executablePath=p;break;}catch{}
  assert.ok(executablePath,'No installed Chromium browser found (no automatic downloads)');
  const results={status:'UNKNOWN',engine:executablePath.split('/').at(-1),node:process.version,toolSha256:sha(await fs.readFile(new URL('./browser.mjs',import.meta.url))),exclusiveWindowConfirmed:true,profiles:[]};
  const lock=await readJson('tools/static-build/resources.lock.json');
  for(const profile of ['global','china']) {
    const host=await serve(profile), row={profile,basePath:host.manifest.basePath,status:'UNKNOWN',checks:[],requests:[],responses:[],console:[],pageErrors:[],workers:[],csp:[],failures:[]};results.profiles.push(row);
    row.artifactSourceCommit=host.manifest.sourceCommit;row.artifactManifestSha256=sha(await fs.readFile(path.join(ROOT,`dist/${profile}/build-manifest.json`)));
    let context;const pending=[];
    const check=async(name,fn)=>{try{const detail=await fn();row.checks.push({name,status:'VERIFIED',detail});}catch(e){row.checks.push({name,status:'BLOCKED',error:e.message});}};
    try {
      const profileDir=await fs.mkdtemp(path.join(ROOT,`.f1/tmp/browser-${profile}-`));
      context=await chromium.launchPersistentContext(profileDir,{executablePath,headless:true,viewport:{width:1440,height:1000},env:{...process.env,TEMP:path.join(ROOT,'.f1/tmp'),TMP:path.join(ROOT,'.f1/tmp'),TMPDIR:path.join(ROOT,'.f1/tmp')},args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
      row.browserVersion=context.browser()?.version()??'persistent Chromium';
      await context.exposeBinding('__f1ReportCsp',(_source,violation)=>row.csp.push(violation));
      await context.addInitScript(()=>{document.addEventListener('securitypolicyviolation',e=>window.__f1ReportCsp({directive:e.violatedDirective,blockedURI:e.blockedURI,disposition:e.disposition}));});
      const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(20000);
      page.on('console',m=>row.console.push({type:m.type(),text:m.text()}));page.on('pageerror',e=>row.pageErrors.push(e.message));
      page.on('worker',w=>row.workers.push(w.url()));page.on('request',r=>row.requests.push({url:r.url(),type:r.resourceType()}));
      page.on('requestfailed',r=>row.failures.push({url:r.url(),error:r.failure()?.errorText}));
      page.on('response',res=>{const d=lock.dependencies.find(d=>d[profile]===res.url());pending.push((async()=>{const entry={url:res.url(),status:res.status()};if(d){try{entry.sha256=sha(await res.body());entry.hashMatches=entry.sha256===d.sha256;}catch(e){entry.bodyError=e.message;}}row.responses.push(entry);})());});
      await check('entry redirect, initialization and shape rendering',async()=>{await page.goto(host.url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForURL(host.url+'en/');await page.waitForFunction(()=>document.querySelectorAll('#starting-shapes canvas').length===4);assert.equal(await page.locator('#lang-preference').inputValue(),'en');return {path:new URL(page.url()).pathname,startingShapes:await page.locator('#starting-shapes canvas').count()};});
      await check('shape input, Solver Worker, solution and 2D graph',async()=>{
        await page.fill('#target-input','CuCu----');await page.click('#add-target-shape-btn');assert.equal(await page.locator('#target-shapes canvas').count(),1);
        // Bound the smoke task to a one-operation solution, using unchanged controls.
        await page.locator('.operation-item.enabled').evaluateAll(nodes=>nodes.forEach(n=>{if(n.dataset.operation!=='Half Destroyer')n.click();}));
        await page.click('#panel-solver .btn-primary');await page.waitForFunction(()=>document.querySelector('#status-dot')?.classList.contains('done'));
        const graph=await page.evaluate(async()=>{const m=await import(new URL('operationGraph.js',document.baseURI).href),cy=m.getCyInstance();return {nodes:cy?.nodes().length,edges:cy?.edges().length};});
        assert.ok(graph.nodes>=3&&graph.edges>=2);assert.ok(row.workers.some(u=>u===new URL('shapeSolver.js',host.url).href));return graph;
      });
      await check('2D direction control and actual ELK adapter execution',async()=>{
        await page.selectOption('#direction-select','TB');
        const positions=await page.evaluate(async()=>{const m=await import(new URL('operationGraph.js',document.baseURI).href),cy=m.getCyInstance(),layout=cy.layout({name:'elk',fit:true,elk:{'elk.algorithm':'layered','elk.direction':'DOWN'}}),stopped=layout.promiseOn('layoutstop');layout.run();await Promise.race([stopped,new Promise((_,reject)=>setTimeout(()=>reject(Error('ELK layout timed out')),10000))]);return cy.nodes().map(n=>n.position());});
        assert.ok(positions.length>=3&&positions.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));await page.screenshot({path:path.join(ROOT,`.f1/evidence/${profile}-2d.png`),fullPage:true});return {direction:await page.locator('#direction-select').inputValue(),positions};
      });
      await check('Explorer Worker and actual 3D WebGL graph',async()=>{
        await page.click('.mode-tab[data-mode="explorer"]');await page.fill('#depth-limit-input','1');await page.click('#panel-explorer .btn-primary');
        await page.waitForFunction(()=>document.querySelector('#status-dot')?.classList.contains('done'));
        const canvas=page.locator('#graph-container canvas');await canvas.waitFor({state:'visible'});
        const webgl=await canvas.evaluate(c=>({width:c.width,height:c.height,webgl:!!(c.getContext('webgl2')||c.getContext('webgl')||c.getContext('experimental-webgl'))}));assert.ok(webgl.width>0&&webgl.height>0&&webgl.webgl);await page.waitForTimeout(1200);await page.screenshot({path:path.join(ROOT,`.f1/evidence/${profile}-3d.png`),fullPage:true});return webgl;
      });
      await check('Barlow original normal/italic weights and fallback policy',async()=>{
        const fonts=await page.evaluate(async()=>{const rows=[];for(const style of ['normal','italic'])for(const w of [100,200,300,400,500,600,700,800,900]){try{const faces=await document.fonts.load(`${style} ${w} 16px Barlow`,'Shapez 2 Solver');rows.push({style,weight:w,count:faces.length,loaded:faces.length>0&&faces.every(f=>f.status==='loaded')});}catch(e){rows.push({style,weight:w,loaded:false,error:e.message});}}return rows;});
        assert.ok(fonts.every(f=>f.loaded),JSON.stringify(fonts));return fonts;
      });
      await check('Mixing Worker and mixing graph',async()=>{await page.click('.sidebar-tab[data-panel="mixing"]');await page.click('#mix-manual-inputs + .toggle-track');await page.fill('.mix-color-row[data-color="red"] .mix-have','1');await page.fill('.mix-color-row[data-color="green"] .mix-have','1');await page.fill('.mix-color-row[data-color="yellow"] .mix-want','2');await page.click('#solve-mix');await page.waitForFunction(()=>document.querySelector('#status-dot')?.classList.contains('done'));assert.ok(row.workers.some(u=>u===new URL('mixingSolver.js',host.url).href));return {workers:row.workers};});
      await check('locale switch and refresh under deployment prefix',async()=>{await page.selectOption('#lang-preference','en');await page.waitForURL(host.url+'en/');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#starting-shapes canvas').length===4);assert.equal(await page.locator('#lang-preference').inputValue(),'en');await page.goto(host.url+'en/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#starting-shapes canvas').length===4);return {path:new URL(page.url()).pathname};});
      await check('served release identity and default strict Solver Worker',async()=>{
        const input=(await readJson('docs/strict-orientation-constructive-20261030/measured-cases.json')).find(c=>c.id==='S2').input;
        const observed=await page.evaluate(async({input,base})=>{
          const manifest=await (await fetch(new URL('build-manifest.json',base))).json();
          const release=await (await fetch(new URL('release.json',base))).json();
          const result=await new Promise((resolve,reject)=>{
            const w=new Worker(new URL('shapeSolver.js',base),{type:'module'});
            const timer=setTimeout(()=>{w.terminate();reject(Error('Strict Worker timeout'));},10000);
            w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message));};
            w.onmessage=e=>{if(e.data.type==='result'){clearTimeout(timer);w.terminate();resolve(e.data.result);}};
            w.postMessage({action:'solve',data:input});
          });
          return {manifest,release,result};
        },{input,base:host.url});
        assert.equal(observed.manifest.sourceCommit,host.manifest.sourceCommit);
        assert.equal(observed.manifest.sourceTree,host.manifest.sourceTree);
        assert.equal(observed.manifest.identity.valid,true);
        assert.equal(observed.release.release,'shapez2-solver-release1');
        assert.deepEqual(observed.release.strictOrdinaryConstructive,{defaultEnabled:true,featureFlag:false,cooperativeBudgetMs:50});
        assert.equal(observed.result.solverRoute,'strict-ordinary-constructive');
        assert.equal(observed.result.strictConstructiveAttempt.accepted,true);
        const {replay}=await import('../release1/replay.mjs');
        const {replaySolution}=await import('../../tests/helpers/shapeSolverOracle.mjs');
        assert.equal(replay(input,observed.result.solutionPath).valid,true);
        assert.equal(replaySolution(input,observed.result.solutionPath,observed.result).valid,true);
        return {sourceCommit:observed.manifest.sourceCommit,sourceTree:observed.manifest.sourceTree,route:observed.result.solverRoute,independentlyReplayed:true};
      });
      await page.screenshot({path:path.join(ROOT,`.f1/evidence/${profile}-page.png`),fullPage:true});
      await Promise.all(pending);
      await check('all five real CDN responses match reviewed bytes',async()=>{for(const d of lock.dependencies){const entries=row.responses.filter(r=>r.url===d[profile]);assert.ok(entries.length>0&&entries.every(r=>r.status===200&&r.hashMatches),d.name);}return {scripts:5,network:'native browser requests; no interception or mock'};});
      await check('no unexpected domains, local 404, console error or CSP violation',async()=>{
        const allowed=new Set([new URL(host.url).origin,...lock.dependencies.map(d=>new URL(d[profile]).origin),...(profile==='global'?['https://fonts.googleapis.com','https://fonts.gstatic.com']:[])]);
        const unexpected=row.requests.filter(r=>/^https?:/.test(r.url)&&!allowed.has(new URL(r.url).origin));assert.deepEqual(unexpected,[]);assert.deepEqual(row.csp,[]);assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.console.filter(m=>m.type==='error'),[]);assert.deepEqual(row.failures,[]);assert.deepEqual(host.requests.filter(r=>r.status>=400),[]);return {requests:row.requests.length};
      });
      // Block only font requests to verify core UI/Worker functionality survives.
      await check('font failure leaves Solver functional',async()=>{
        await context.route(profile==='global'?'https://fonts.googleapis.com/**':'**/assets/fonts/**',route=>route.abort());
        const fallback=await context.newPage();await fallback.goto(host.url+'en/',{waitUntil:'domcontentloaded'});await fallback.waitForFunction(()=>document.querySelectorAll('#starting-shapes canvas').length===4);
        await fallback.fill('#target-input','CuCuCuCu');await fallback.click('#add-target-shape-btn');await fallback.click('#panel-solver .btn-primary');await fallback.waitForFunction(()=>document.querySelector('#status-dot')?.classList.contains('done'));await fallback.close();return 'Intentional font-only failure; initialization and actual Solver Worker succeeded';
      });
    }catch(error){row.error=error.stack;}finally{if(context)await context.close();row.localRequests=host.requests;await host.close();}
    row.status=!row.error&&row.checks.length===11&&row.checks.every(c=>c.status==='VERIFIED')?'VERIFIED':'BLOCKED';
    await writeJson(destination,results);
  }
  results.status=results.profiles.every(r=>r.status==='VERIFIED')?'VERIFIED':'BLOCKED';await writeJson(destination,results);console.log(results.status);if(results.status!=='VERIFIED')process.exitCode=1;
}
