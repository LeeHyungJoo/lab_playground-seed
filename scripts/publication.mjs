import { createHash } from 'node:crypto';
import policy from '../docs/data/editorial-policy.json' with {type:'json'};
import {CATEGORIES,categoryId,dayInSeoul,publicationGroup,hasPublication,isDaily,stableId,normalizeText,readingMinutes} from '../docs/lib/catalog.mjs';
export {policy,dayInSeoul};
export const GROUPS=['development','news','culture'];
export class PublicationError extends Error {constructor(code,message){super(message);this.code=code;}}
const fail=(code,message)=>{throw new PublicationError(code,message);};
export const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function cultureCategory(day,settings=policy) {
 if(!validDay(day))fail('invalid-date','유효한 한국 날짜가 필요합니다.');
 const offset=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(settings.cultureAnchorDate+'T00:00:00Z'))/86400000);
 return settings.cultureRotation[((offset%settings.cultureRotation.length)+settings.cultureRotation.length)%settings.cultureRotation.length];
}
export function planDay(posts,day=dayInSeoul(),state={},settings=policy) {
 return {date:day,timezone:settings.timezone,policyVersion:settings.version,cultureCategory:cultureCategory(day,settings),groups:Object.fromEntries(GROUPS.map(group=>{
  const existing=posts.filter(p=>p.date===day&&isDaily(p)&&publicationGroup(p)===group);
  return [group,{status:existing.length?'published':state.days?.[day]?.groups?.[group]?.status||'missing',count:existing.length,articleId:existing[0]?stableId(existing[0]):null,needsGeneration:!existing.length}];
 }))};
}
function moment(value) {
 if(validDay(value))return Date.parse(value+'T00:00:00+09:00');
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return Date.parse(value);
 return NaN;
}
function requireText(value,label,max=3000){if(typeof value!=='string'||!value.trim()||value.length>max)fail('invalid-content',`${label}이 없거나 길이가 잘못되었습니다.`);}
function sourceURL(value) {
 let u;try{u=new URL(value);}catch{fail('invalid-source-url','출처 URL 형식이 잘못되었습니다.');}
 const host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|example|invalid)$/.test(host)||/^(?:www\.)?example\.(com|net|org)$/.test(host))fail('invalid-source-url','공개 HTTPS 출처만 허용합니다.');
 return u;
}
export async function verifySourceURL(url,{fetcher=fetch}={}) {
 let current=sourceURL(url);
 for(let redirects=0;redirects<4;redirects++){
  let response;
  try{response=await fetcher(current.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Jininsa-Editorial-Source-Check/2.0'}});}catch{fail('source-unreachable',`출처에 접근할 수 없습니다: ${current.hostname}`);}
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)break;current=sourceURL(new URL(location,current).href);continue;}
  await response.body?.cancel();
  if(!response.ok)fail('source-unreachable',`출처 응답 오류 (${response.status}): ${current.hostname}`);
  return {url:current.href,host:current.hostname};
 }
 fail('source-unreachable','출처의 리디렉션을 확인할 수 없습니다.');
}
const tokens=value=>new Set(String(value||'').normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1));
const similarity=(a,b)=>{const union=new Set([...a,...b]);return union.size?[...a].filter(x=>b.has(x)).length/union.size:0;};
function concept(value,settings=policy){const key=normalizeText(value);return settings.conceptAliases[key]||key;}
const canonicalTopic=p=>normalizeText(p.topicKey);
const authority=url=>{const host=sourceURL(url).hostname.replace(/^www\./,'');const parts=host.split('.');return /\.(co|ac)\.uk$/.test(host)?parts.slice(-3).join('.'):parts.slice(-2).join('.');};
function eventIdentity(event) {return [event.subject,event.action,event.occurredOn||String(event.occurredAt||'').slice(0,10)].map(normalizeText).join(':');}
function validFollowup(candidate,previous) {
 const e=candidate.event,old=previous.event;
 if(!e||!old||e.followUpOf!==old.key||normalizeText(e.subject)!==normalizeText(old.subject))return false;
 const known=new Set([...(old.facts||[]),...(old.newFacts||[])].map(normalizeText));
 const fresh=new Set((e.newFacts||[]).map(normalizeText).filter(x=>x.length>=12&&!known.has(x)));
 return fresh.size>=2&&new Set((candidate.sources||[]).map(s=>authority(s.url))).size>=2;
}
export function duplicateReason(candidate,posts,settings=policy) {
 const category=categoryId(candidate.category);const title=normalizeText(candidate.title);
 const parent=posts.find(p=>p.event?.key===candidate.event?.followUpOf);
 const related=posts.filter(p=>p.event&&normalizeText(p.event.subject)===normalizeText(candidate.event?.subject));
 const known=new Set(related.flatMap(p=>[...(p.event.facts||[]),...(p.event.newFacts||[])]).map(normalizeText));
 const fresh=new Set((candidate.event?.newFacts||[]).map(normalizeText).filter(x=>x.length>=12&&!known.has(x)));
 const followup=!!parent&&validFollowup(candidate,parent)&&fresh.size>=2;
 for(const p of posts){
  if(title&&title===normalizeText(p.title))return '동일한 제목';
  if(candidate.repository&&candidate.repository.toLowerCase()===p.repository?.toLowerCase())return '이미 소개한 GitHub 저장소';
  const sameTopic=canonicalTopic(candidate)&&canonicalTopic(candidate)===canonicalTopic(p);
  if(category==='news'&&p.event){
   const sameEvent=candidate.event?.key===p.event.key||eventIdentity(candidate.event||{})===eventIdentity(p.event);
   const sameSubjectAction=normalizeText(candidate.event?.subject)===normalizeText(p.event.subject)&&normalizeText(candidate.event?.action)===normalizeText(p.event.action);
   if((sameEvent||sameSubjectAction||candidate.event?.followUpOf===p.event.key)&&!followup)return '동일 사건 또는 새로운 사실이 부족한 후속 보도';
  }
  if(sameTopic&&!(category==='news'&&followup))return '동일한 주제 식별자';
  if(category===categoryId(p.category)&&!(category==='news'&&followup)){
   if(category!=='news'&&candidate.coreConcept&&p.coreConcept&&concept(candidate.coreConcept,settings)===concept(p.coreConcept,settings))return '동일한 핵심 개념';
   const wordsA=tokens((candidate.keywords||[]).join(' ')),wordsB=tokens((p.keywords||[]).join(' '));
   const summaries=similarity(tokens(candidate.semanticSummary||candidate.summary),tokens(p.semanticSummary||p.summary));
   if(summaries>=0.84||(wordsA.size>=3&&wordsB.size>=3&&similarity(wordsA,wordsB)>=0.75&&summaries>=0.42))return '핵심 키워드·요약이 겹치는 주제';
  }
 }
 return null;
}
export async function validateArticle(draft,posts,{day=dayInSeoul(),now=new Date(),settings=policy,checkSource=verifySourceURL}={}) {
 if(!validDay(day))fail('invalid-date','유효한 한국 날짜가 필요합니다.');
 const freshnessTime=Math.max(now.getTime(),Date.parse(`${day}T${settings.publishTime}+09:00`));
 const p=structuredClone(draft);const category=categoryId(p.category);
 if(!category)fail('invalid-category','허용되지 않은 카테고리입니다.');
 const group=CATEGORIES[category].publicationGroup;
 if(p.publicationGroup&&p.publicationGroup!==group)fail('invalid-group','카테고리와 발행 그룹이 일치하지 않습니다.');
 if(!validDay(p.date)||p.date!==day)fail('wrong-day','대상 한국 날짜와 아티클 날짜가 다릅니다.');
 if(!['draft','published',undefined].includes(p.status))fail('invalid-status','발행 후보 상태가 아닙니다.');
 for(const key of ['title','summary'])requireText(p[key],key,key==='title'?300:2000);
 if(!/[가-힣]/.test(p.summary))fail('invalid-content','요약은 한국어로 작성해야 합니다.');
 if(!Array.isArray(p.highlights)||p.highlights.length!==3||p.highlights.some(x=>typeof x!=='string'||!x.trim()))fail('invalid-content','핵심 내용 3개가 필요합니다.');
 if(group==='development'){
  if(!/^[\w.-]+\/[\w.-]+$/.test(p.repository||''))fail('invalid-repository','GitHub 저장소 식별자가 필요합니다.');
  if(p.url!==`https://github.com/${p.repository}`)fail('invalid-repository','공식 GitHub 저장소 링크가 필요합니다.');
  requireText(p.why,'활용 이유');
  p.sources=p.sources?.length?p.sources:[{title:'공식 저장소',url:p.url,type:'primary',verifiedAt:now.toISOString()}];
 } else {
  requireText(p.topicKey,'주제 식별자',300);requireText(p.coreConcept,'핵심 개념',300);requireText(p.semanticSummary,'중복 확인 요약',2000);
  if(!Array.isArray(p.keywords)||new Set(p.keywords.map(normalizeText)).size<3)fail('invalid-topic','핵심 키워드 3개 이상이 필요합니다.');
  if(!Array.isArray(p.content)||p.content.length<3)fail('invalid-content','구조화된 본문 3개 절 이상이 필요합니다.');
  for(const section of p.content){requireText(section.heading,'절 제목',300);if(!Array.isArray(section.paragraphs)||!section.paragraphs.length)fail('invalid-content','각 절에는 본문 문단이 필요합니다.');for(const paragraph of section.paragraphs)requireText(paragraph,'본문 문단',5000);if(section.bullets&&(!Array.isArray(section.bullets)||section.bullets.some(x=>typeof x!=='string')))fail('invalid-content','목록 형식이 잘못되었습니다.');}
  const range=settings.readingMinutes[category];const minutes=readingMinutes(p);
  if(minutes<range[0]||minutes>range[1])fail('reading-length',`${category} 본문은 ${range[0]}~${range[1]}분 분량이어야 합니다. 현재 ${minutes}분입니다.`);
  if(group==='culture'&&category!==cultureCategory(day,settings))fail('rotation-mismatch',`오늘 교양 카테고리는 ${cultureCategory(day,settings)}입니다.`);
 }
 if(!Array.isArray(p.sources)||!p.sources.length)fail('missing-sources','검증 가능한 출처가 필요합니다.');
 const hosts=new Set();let hasPrimary=false;
 for(const source of p.sources){
  requireText(source.title,'출처 제목',500);const u=sourceURL(source.url);hasPrimary ||= source.type==='primary';
  const verified=moment(source.verifiedAt);if(!Number.isFinite(verified)||verified>now.getTime()+60000||now.getTime()-verified>settings.newsMaxAgeHours*3600000)fail('unverified-source','출처를 최근에 직접 확인한 기록이 필요합니다.');
  if(category==='news'){
   const published=moment(source.publishedAt);if(!Number.isFinite(published)||published>now.getTime()||freshnessTime-published>settings.newsMaxAgeHours*3600000)fail('stale-source','뉴스 원문 게시일이 없거나 최근 72시간 범위를 벗어났습니다.');
  }
  if(category==='health'&&!settings.healthSourceDomains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))fail('untrusted-health-source','건강 글에는 신뢰할 수 있는 의료기관·학술 출처가 필요합니다.');
  const checked=await checkSource(source.url);const resolved=checked?.url||source.url;hosts.add(authority(resolved));
  if(category==='health'&&!settings.healthSourceDomains.some(d=>sourceURL(resolved).hostname===d||sourceURL(resolved).hostname.endsWith('.'+d)))fail('untrusted-health-source','건강 자료의 최종 주소가 신뢰할 수 있는 출처가 아닙니다.');
 }
 if(category==='news'){
  if(hosts.size<settings.newsMinIndependentSources||!hasPrimary)fail('news-source-count','뉴스에는 서로 다른 출처 2곳과 1차 자료가 필요합니다.');
  const event=p.event;if(!event||typeof event!=='object')fail('missing-event','뉴스 사건 정보가 필요합니다.');
  for(const key of ['subject','action','key'])requireText(event[key],`사건 ${key}`,500);
  if(!Array.isArray(event.facts)||event.facts.length<2||event.facts.some(x=>typeof x!=='string'||!x.trim()))fail('missing-event','핵심 사건 사실 2개 이상이 필요합니다.');
  const occurred=moment(event.occurredAt||event.occurredOn);
  if(!Number.isFinite(occurred)||occurred>now.getTime()||freshnessTime-occurred>settings.newsMaxAgeHours*3600000)fail('stale-event','실제 사건 발생일이 최근 72시간 이내여야 합니다.');
  p.topicKey=p.topicKey||`news:${event.key}`;
 }
 if(category==='economy')for(const metric of p.statistics||[]){if(!validDay(metric.asOf)||moment(metric.asOf)>now.getTime()||!p.sources.some(s=>s.url===metric.sourceUrl))fail('unsourced-statistic','경제 수치는 기준 날짜와 일치하는 출처가 필요합니다.');}
 const duplicate=duplicateReason(p,posts,settings);if(duplicate)fail('duplicate-topic',duplicate);
 const id=p.id||`${day}-${group}-${createHash('sha256').update(p.topicKey||p.repository||p.title).digest('hex').slice(0,12)}`;
 if(posts.some(x=>stableId(x)===id))fail('duplicate-id','이미 사용한 아티클 ID입니다.');
 return {...p,schemaVersion:2,id,category,group:CATEGORIES[category].scope,publicationGroup:group,kind:'daily',status:'published',publishedAt:`${day}T${settings.publishTime}+09:00`,readingMinutes:readingMinutes(p),generatedAt:p.generatedAt||now.toISOString()};
}
export async function publishBundle(originalPosts,originalState,bundle,{day=dayInSeoul(),now=new Date(),settings=policy,checkSource=verifySourceURL}={}) {
 if(!validDay(day))fail('invalid-date','유효한 한국 날짜가 필요합니다.');
 if(!originalState||typeof originalState!=='object'||Array.isArray(originalState)||(originalState.days&&(typeof originalState.days!=='object'||Array.isArray(originalState.days))))fail('corrupt-ledger','발행 이력 형식이 손상되었습니다. 덮어쓰지 않습니다.');
 if(!Array.isArray(originalPosts))fail('corrupt-store','기존 게시글 데이터가 배열이 아닙니다. 덮어쓰지 않습니다.');
 if(!bundle||bundle.schemaVersion!==2||bundle.policyVersion!==settings.version||bundle.date!==day||!Array.isArray(bundle.drafts)||!Array.isArray(bundle.holds||[]))fail('invalid-bundle','후보 묶음의 버전·날짜·구조가 잘못되었습니다.');
 let posts=structuredClone(originalPosts);const state=structuredClone(originalState||{schemaVersion:2,days:{}});state.schemaVersion=2;state.days ||= {};
 const previous=state.days[day]||{date:day,groups:{}};const record={...previous,policyVersion:settings.version,groups:{...previous.groups}};const results=[];
 const fingerprint=createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
 for(const group of GROUPS){
  const existing=posts.find(p=>p.date===day&&isDaily(p)&&publicationGroup(p)===group);
  if(existing){record.groups[group]={...record.groups[group],status:'published',articleId:stableId(existing),publishedAt:existing.publishedAt||existing.generatedAt};results.push({group,status:'skipped',articleId:stableId(existing)});continue;}
  const candidates=bundle.drafts.filter(p=>publicationGroup(p)===group||p.publicationGroup===group);
  const hold=(bundle.holds||[]).find(p=>p.group===group);
  const old=record.groups[group]||{attempts:[]};
  let outcome;
  if(candidates.length>1)outcome={status:'failed',code:'multiple-candidates',message:'동일 그룹에 후보가 두 개 이상입니다.'};
  else if(candidates.length===1){
   try{const post=await validateArticle(candidates[0],posts,{day,now,settings,checkSource});posts.unshift(post);outcome={status:'published',articleId:post.id,publishedAt:post.publishedAt,code:'published',message:'검증 후 저장했습니다.'};}
   catch(error){outcome={status:group==='news'?'held':'failed',code:error.code||'validation-error',message:error.message};}
  }else if(hold)outcome={status:'held',code:hold.code||'editorial-hold',message:String(hold.reason||'검증 가능한 자료를 확보하지 못했습니다.').slice(0,1000)};
  else outcome={status:'missing',code:'no-candidate',message:'이 그룹의 발행 후보가 아직 없습니다.'};
  const attempt={at:now.toISOString(),status:outcome.status,code:outcome.code,message:outcome.message,bundleId:bundle.id||fingerprint.slice(0,16)};
  record.groups[group]={...old,...outcome,fingerprint,lastAttemptAt:now.toISOString(),attempts:[...(old.attempts||[]),attempt]};results.push({group,...outcome});
 }
 record.updatedAt=results.some(r=>!r.replayed&&r.status!=='skipped')?now.toISOString():previous.updatedAt||now.toISOString();record.runs=[...(previous.runs||[]),{at:now.toISOString(),bundleId:bundle.id||fingerprint.slice(0,16),results:results.map(r=>({group:r.group,status:r.status,code:r.code}))}];state.days[day]=record;
 return {posts,state,results,complete:GROUPS.every(group=>hasPublication(posts,day,group))};
}
