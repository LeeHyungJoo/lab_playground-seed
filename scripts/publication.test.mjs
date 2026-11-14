import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {policy,dayInSeoul,scheduledGroups,cultureCategory,planDay,publishBundle,validateArticle,duplicateReason,verifySourceURL} from './publication.mjs';
import {publishFiles,writeDataPair} from './publication-cli.mjs';
import {hasPublication} from '../docs/lib/catalog.mjs';
const day='2026-11-13',now=new Date('2026-11-13T07:00:00Z');
const verifiedAt=now.toISOString();const checkSource=async()=>({});
const allDays=[0,1,2,3,4,5,6];
const testPolicy={...policy,publicationSchedule:{development:allDays,news:allDays,culture:allDays}};
const source=(host='example-source.org',extra={})=>({title:'검증한 공식 자료',url:`https://${host}/article`,verifiedAt,type:'primary',publishedAt:'2026-11-12',...extra});
function life(category='philosophy',date=day,extra={}) {
 const count=category==='news'?58:38;
 const text=Array.from({length:count},(_,i)=>`자료에서 확인한 개념을 일상 사례와 연결해 살펴보는 ${i}번째 설명입니다.`).join(' ');
 return {schemaVersion:2,id:`${date}-${category}`,category,date,title:`${category}에 관한 새로운 생각`,summary:'검증한 자료에 근거해 일상과 연결한 한국어 해설입니다.',highlights:['첫 번째 핵심 내용입니다.','두 번째 핵심 내용입니다.','세 번째 핵심 내용입니다.'],content:[{heading:'개념의 배경',paragraphs:[text]},{heading:'생활 속에서 생각하기',paragraphs:['일상의 사례와 원리를 차분하게 살펴봅니다.']},{heading:'함께 생각할 질문',paragraphs:['원문에서 조건을 확인하고 자신의 상황에 비추어 생각해 보세요.']}],topicKey:`${category}:unique-concept`,coreConcept:`${category}-concept`,keywords:['핵심개념','일상사례','고유한주제'],semanticSummary:`${category}의 독립적인 핵심 개념을 다루는 해설입니다.`,sources:category==='news'?[source('official.org'),source('independent.org')]:[source()],...(category==='news'?{event:{subject:'연구기관',action:'새로운 관측 자료 공개',occurredOn:'2026-11-12',key:'research-release-20261112',facts:['검증한 기관이 새로운 자료를 공개했다.','자료의 분석 결과와 한계를 설명했다.']}}:{}),...extra};
}
const dev=extra=>({category:'AI',date:day,title:'개발 프로젝트 소개',summary:'개발자에게 도움이 되는 도구입니다.',highlights:['첫째 기능','둘째 기능','셋째 기능'],why:'공식 자료에서 기능과 조건을 확인하세요.',repository:'owner/new-project',url:'https://github.com/owner/new-project',...extra});
const bundle=(drafts=[],holds=[])=>({schemaVersion:2,policyVersion:policy.version,date:day,id:'test-bundle',drafts,holds});
const options={day,now,checkSource,settings:testPolicy};
test('Korean dates, weekday schedules and culture publication-slot rotation remain stable',()=>{
 assert.equal(dayInSeoul(new Date('2026-11-12T15:00:00Z')),day);
 assert.deepEqual(scheduledGroups('2026-11-16'),['development','news']);
 assert.deepEqual(scheduledGroups('2026-11-17'),['culture']);
 assert.deepEqual(scheduledGroups('2026-11-18'),['news']);
 assert.deepEqual(scheduledGroups('2026-11-19'),['development']);
 assert.deepEqual(scheduledGroups('2026-11-20'),['news','culture']);
 assert.deepEqual(scheduledGroups('2026-11-21'),[]);
 assert.equal(cultureCategory('2026-11-13'),'philosophy');
 assert.equal(cultureCategory('2026-11-17'),'economy');
 assert.equal(cultureCategory('2026-11-20'),'health');
 assert.equal(cultureCategory('2026-11-24'),'philosophy');
 assert.throws(()=>cultureCategory('2026-02-30'));
});
test('three independent slots publish once and preserve the exact legacy article objects',async()=>{
 const legacy={...dev({repository:'legacy/project',url:'https://github.com/legacy/project',date:'2026-11-12',title:'기존 글',summary:'서로 다른 자료를 비교하는 과학 연구 플랫폼을 소개한 이전 기록입니다.',kind:'daily'}),legacyExtra:'preserve'};
 const initial=[legacy];const r=await publishBundle(initial,{},bundle([dev(),life('news'),life()]),options);
 assert.equal(r.complete,true);assert.equal(r.posts.length,4);assert.deepEqual(initial,[legacy]);assert.deepEqual(r.posts.at(-1),legacy);
 assert.deepEqual(r.results.map(x=>x.status),['published','published','published']);
 const again=await publishBundle(r.posts,r.state,bundle([dev(),life('news'),life()]),options);
 assert.equal(again.posts.length,4);assert.ok(again.results.every(x=>x.status==='skipped'));
 for(const group of ['development','news','culture'])assert.equal(hasPublication(again.posts,day,group),true);
});
test('one legacy development post does not block news/culture; news failure does not roll back culture',async()=>{
 const existing=dev({kind:'daily'});const stale=life('news',day,{event:{...life('news').event,occurredOn:'2026-11-01'}});
 const r=await publishBundle([existing],{},bundle([stale,life()]),options);
 assert.equal(r.posts.length,2);assert.equal(r.results[0].status,'skipped');assert.equal(r.results[1].status,'held');assert.equal(r.results[1].code,'stale-event');assert.equal(r.results[2].status,'published');
 const retry=await publishBundle(r.posts,r.state,bundle([life('news')]),options);
 assert.equal(retry.complete,true);assert.equal(retry.posts.length,3);assert.deepEqual(retry.results.map(x=>x.status),['skipped','published','skipped']);
});
test('news checks the occurrence date, source publication date, independent organizations and source access',async()=>{
 await assert.rejects(()=>validateArticle(life('news',day,{sources:[source('press.official.org'),source('news.official.org')]}),[],options),e=>e.code==='news-source-count');
 await assert.rejects(()=>validateArticle(life('news'),[],{...options,checkSource:async()=>({url:'https://same-organization.org/article'})}),e=>e.code==='news-source-count');
 await assert.rejects(()=>validateArticle(life('news',day,{sources:[source('official.org',{publishedAt:'2020-01-01'}),source('independent.org')]}),[],options),e=>e.code==='stale-source');
 await assert.rejects(()=>validateArticle(life('news',day,{event:{...life('news').event,occurredOn:'2026-11-14'}}),[],options),e=>e.code==='stale-event');
 await assert.rejects(()=>validateArticle(life('news',day,{sources:[source('official.org',{publishedAt:undefined}),source('independent.org')]}),[],options),e=>e.code==='stale-source');
 await assert.rejects(()=>validateArticle(life('news'),[],{...options,checkSource:async()=>{throw new Error('offline');}}),/offline/);
 const edge=life('news',day,{event:{...life('news').event,occurredAt:new Date(now-72*3600000).toISOString()}});
 assert.equal((await validateArticle(edge,[],options)).category,'news');
 await assert.rejects(()=>validateArticle({...edge,event:{...edge.event,occurredAt:new Date(now-72*3600000-1).toISOString()}},[],options),e=>e.code==='stale-event');
});
test('duplicate coverage includes titles, repositories, concepts, summaries and same events across outlets',()=>{
 assert.equal(duplicateReason(dev({title:'개발, 프로젝트 소개!'}),[dev()]),'동일한 제목');
 assert.equal(duplicateReason(dev({title:'다른 제목'}),[dev()]),'이미 소개한 GitHub 저장소');
 const previous=life();
 assert.equal(duplicateReason(life('philosophy',day,{title:'또 다른 제목',topicKey:'different',coreConcept:'통제의 이분법'}),[{...previous,coreConcept:'dichotomy of control'}]),'동일한 핵심 개념');
 const otherConcept={...previous,title:'같은 철학자의 다른 개념',topicKey:'philosophy:epictetus:assent',coreConcept:'assent',keywords:['동의','인상','판단'],semanticSummary:'인상을 즉시 사실로 받아들이지 않고 판단을 유보하는 개념입니다.'};
 assert.equal(duplicateReason(otherConcept,[previous]),null);
 const story=life('news');assert.match(duplicateReason({...story,title:'다른 매체의 다른 제목',topicKey:'another',event:{...story.event,key:'other-key'}},[story]),/동일 사건/);
 assert.equal(duplicateReason({...previous,title:'중복을 숨기는 제목',topicKey:'other-key',coreConcept:'other-concept'},[previous]),'핵심 키워드·요약이 겹치는 주제');
});
test('follow-up requires a real parent, two genuinely additional facts and independent sources',()=>{
 const old=life('news');const follow={...old,title:'관측 자료 공개 이후의 새 발견',topicKey:'news:next-event',event:{...old.event,key:'next-event',followUpOf:old.event.key,newFacts:['추가 관측에서 기존 자료에 없던 새로운 항목이 확인됐다.','연구진은 후속 측정 결과와 검증 방법을 새로 공개했다.']}};
 assert.equal(duplicateReason(follow,[old]),null);
 assert.match(duplicateReason({...follow,event:{...follow.event,newFacts:['기존 자료를 다시 설명했다.']}},[old]),/후속/);
 assert.match(duplicateReason({...follow,event:{...follow.event,followUpOf:'missing'}},[old]),/후속/);
});
test('short, unsourced, wrong-rotation and untrusted-health articles cannot publish',async()=>{
 await assert.rejects(()=>validateArticle(life('philosophy',day,{content:[{heading:'짧은 글',paragraphs:['너무 짧습니다.']},{heading:'둘',paragraphs:['짧습니다.']},{heading:'셋',paragraphs:['짧습니다.']}]}),[],options),e=>e.code==='reading-length');
 await assert.rejects(()=>validateArticle(life('economy'),[],options),e=>e.code==='rotation-mismatch');
 const healthDay='2026-11-15';const healthNow=new Date('2026-11-15T07:00Z');
 await assert.rejects(()=>validateArticle(life('health',healthDay,{sources:[source('random-blog.org',{verifiedAt:healthNow.toISOString()})]}),[],{day:healthDay,now:healthNow,checkSource,settings:testPolicy}),e=>e.code==='untrusted-health-source');
 await assert.rejects(()=>validateArticle(life('philosophy',day,{sources:[]}),[],options),e=>e.code==='missing-sources');
});
test('source checking rejects local/private targets and validates redirects without following them blindly',async()=>{
 for(const url of ['http://official.org/','https://127.0.0.1/','https://localhost/','https://example.com/','https://10.0.0.1/','https://name:password@official.org/'])await assert.rejects(()=>verifySourceURL(url),e=>e.code==='invalid-source-url');
 await assert.rejects(()=>verifySourceURL('https://official.org/',{fetcher:async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}})}),e=>e.code==='invalid-source-url');
 await assert.rejects(()=>verifySourceURL('https://official.org/',{fetcher:async()=>new Response('missing',{status:404})}),e=>e.code==='source-unreachable');
});
test('malformed bundle and invalid stored data cannot overwrite articles; failed writes restore the pair',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'jininsa-publication-'));
 try{
  await fs.mkdir(path.join(base,'docs/data'),{recursive:true});await fs.mkdir(path.join(base,'content/inbox'),{recursive:true});
  const pp=path.join(base,'docs/data/posts.json'),sp=path.join(base,'docs/data/publication-state.json');const old=[dev({date:'2026-11-12'})];
  await fs.writeFile(pp,JSON.stringify(old));await fs.writeFile(sp,JSON.stringify({schemaVersion:2,days:{}}));
  await fs.writeFile(path.join(base,`content/inbox/${day}.json`),'{invalid');
  const result=await publishFiles({base,day,now,checkSource,settings:testPolicy});assert.deepEqual(JSON.parse(await fs.readFile(pp,'utf8')),old);assert.equal(result.results[0].status,'failed');
  const beforeP=await fs.readFile(pp,'utf8'),beforeS=await fs.readFile(sp,'utf8');let renames=0;
  await assert.rejects(()=>writeDataPair(pp,sp,[],{}, {ops:{...fs,rename:async(...args)=>{renames++;if(renames===2)throw Error('simulated second rename failure');return fs.rename(...args);}}}),/second rename/);
  assert.equal(await fs.readFile(pp,'utf8'),beforeP);assert.equal(await fs.readFile(sp,'utf8'),beforeS);
  await fs.writeFile(pp,'{"broken":"not an array"}');await assert.rejects(()=>publishFiles({base,day,now,checkSource,settings:testPolicy}),e=>e.code==='corrupt-store');assert.equal(await fs.readFile(pp,'utf8'),'{"broken":"not an array"}');
  await fs.access(path.join(base,'.publication.lock')).then(()=>assert.fail('Lock leaked'),()=>{});
 }finally{await fs.rm(base,{recursive:true,force:true});}
});
test('explicit news hold records an auditable reason without fabricating a post',async()=>{
 const r=await publishBundle([],{},bundle([dev(),life()],[{group:'news',code:'unverified-event',reason:'최근 72시간 사건을 검증할 수 없습니다.'}]),options);
 assert.equal(r.posts.length,2);assert.equal(r.state.days[day].groups.news.status,'held');assert.match(r.state.days[day].groups.news.attempts[0].message,/72시간/);assert.equal(planDay(r.posts,day,r.state).groups.news.needsGeneration,true);
});

test('financial statistics need an as-of date and an included source; trusted health can publish on its turn',async()=>{
 const economyDay='2026-11-14',economyNow=new Date('2026-11-14T07:00Z');
 const economy=life('economy',economyDay,{sources:[source('bank.org',{verifiedAt:economyNow.toISOString()})],statistics:[{value:'3%',asOf:'2026-11-14',sourceUrl:'https://missing.org/stat'}]});
 await assert.rejects(()=>validateArticle(economy,[],{day:economyDay,now:economyNow,checkSource,settings:testPolicy}),e=>e.code==='unsourced-statistic');
 const healthDay='2026-11-15',healthNow=new Date('2026-11-15T07:00Z');
 const health=life('health',healthDay,{sources:[source('who.int',{verifiedAt:healthNow.toISOString()})]});
 assert.equal((await validateArticle(health,[],{day:healthDay,now:healthNow,checkSource,settings:testPolicy})).category,'health');
});
test('future visibility cannot extend the news 72-hour window beyond the actual 06:00 release',async()=>{
 const early=new Date('2026-11-12T20:58Z');
 const eventTime=new Date(Date.parse('2026-11-12T21:00Z')-72*3600000-1).toISOString();
 const draft=life('news',day,{sources:[source('official.org',{verifiedAt:early.toISOString()}),source('independent.org',{verifiedAt:early.toISOString()})],event:{...life('news').event,occurredAt:eventTime}});
 await assert.rejects(()=>validateArticle(draft,[],{day,now:early,checkSource}),e=>e.code==='stale-event');
});
