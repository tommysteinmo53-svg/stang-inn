import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {scanAvailabilitySources,readOnlyNittenPipelineCheck,AVAILABILITY_SOURCES}=require('../lib/fantasy/availability-source-scan.ts');
const {parseNittenAvailabilityArticle}=require('../lib/fantasy/availability-nitten-parser.ts');
const source=AVAILABILITY_SOURCES[0],url=source.url+'blogg/test';
const players=[{id:'test-a',name:'Test Spiller',team:'Narvik'},{id:'test-b',name:'Annen Spiller',team:'Narvik'},{id:'test-c',name:'Tredje Spiller',team:'Narvik'}];
const byline=(d,m,y)=>`<div>Skrevet av: </div><div>Redaksjonen</div><div class="date dato-dark"><div>${d}</div><div>.</div><div>${m}</div><div>.</div><div>${y}</div></div>`;
const now=Date.now,fetch=globalThis.fetch;
Date.now=()=>Date.parse('2026-09-17T14:00:00Z');
let article='';
globalThis.fetch=async target=>new Response(target===source.url?'<a href="/blogg/test">Artikkel</a>':article,{headers:{'content-type':'text/html'}});
try {
 article=byline('17','09','2026')+'<p>Test Spiller er skadet.</p>';
 let result=await scanAvailabilitySources(players,[source]);
 assert.equal(result.findings.length,1);assert.equal(result.findings[0].sourcePublishedAt,'2026-09-17T12:00:00.000Z');assert.equal(result.diagnostics[0].undated,0);
 assert.equal((await readOnlyNittenPipelineCheck(url,players,players.map(p=>p.name))).publishedAt,result.findings[0].sourcePublishedAt);
 article=byline('01','01','2026')+'<p>Test Spiller er skadet.</p>';
 result=await scanAvailabilitySources(players,[source]);assert.equal(result.findings.length,0);assert.equal(result.diagnostics[0].stale,1);
 article=byline('31','02','2026')+'<p>Test Spiller er skadet.</p>';
 result=await scanAvailabilitySources(players,[source]);assert.equal(result.diagnostics[0].undated,1);
 article='<p>Test Spiller er skadet.</p>';
 result=await scanAvailabilitySources(players,[source]);assert.equal(result.diagnostics[0].undated,1);assert.equal(result.findings.length,0);
 article=byline('25','09','2026')+'<p>Test Spiller er skadet.</p>';
 result=await scanAvailabilitySources(players,[source]);assert.equal(result.diagnostics[0].stale,1);
 for(const text of ['Test Spiller og Annen Spiller er ute for gjestene.','Test Spiller (dag til dag) er ute sammen med Annen Spiller.']) {
  assert.deepEqual(parseNittenAvailabilityArticle(text,players.map(p=>p.name)).map(f=>[f.playerName,f.status]),[['Test Spiller','out'],['Annen Spiller','out']]);
 }
 assert.deepEqual(parseNittenAvailabilityArticle('Test Spiller er ikke ute. Annen Spiller er skadefri. Tredje Spiller trener ute.',players.map(p=>p.name)),[]);
 assert.equal(parseNittenAvailabilityArticle('Test Spiller er ute, mens Annen Spiller er klar.',players.map(p=>p.name)).length,1);
 assert.equal(parseNittenAvailabilityArticle('Test Spiller er tvilsom.',players.map(p=>p.name))[0].status,'questionable');
 // Optional live HTML files: same production discovery/date/parser pipeline, no DB writes.
 if(process.env.NITTEN_ARTICLE_HTML){
  article=fs.readFileSync(process.env.NITTEN_ARTICLE_HTML,'utf8');
  const livePlayers=['John Beaton','Magnus Menkerud','Jakob Rian','Johan Ceder','William Kuisma','Emil Buskoven','Leo Andersen','Mattias Juntti','Lukas Rhodin','Eskil Wold'].map((name,i)=>({id:`fixture-${i}`,name,team:'Testklubb'}));
  const home=fs.readFileSync(process.env.NITTEN_HOME_HTML,'utf8');
  const articleUrl='https://www.nitten.no/blogg/for-dropp-fulltallige-i-storkampen-stjernen-fravaer-i-nord';
  globalThis.fetch=async target=>new Response(target===source.url?home:target===articleUrl?article:'',{headers:{'content-type':'text/html'}});
  const live=await scanAvailabilitySources(livePlayers,[source]);
  assert.equal(live.findings.length,10);assert.ok(live.findings.every(f=>f.sourceUrl===articleUrl&&f.rawStatus==='out'&&f.sourcePublishedAt==='2026-09-17T12:00:00.000Z'));
  console.log('PASS live homepage discovery and article: 10 named absence candidates, correct date');
 }
 console.log('PASS Nitten production scan: split date, freshness, invalid/absent date, grouped absence and healthy-player negatives');
} finally {globalThis.fetch=fetch;Date.now=now;}
