import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {policy,dayInSeoul,planDay,publishBundle,GROUPS,validDay,PublicationError} from './publication.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function writeDataPair(postsPath,statePath,posts,state,{ops=fs}={}) {
 const suffix=`.tmp-${process.pid}-${Date.now()}`;const files=[postsPath,statePath];const temps=files.map(p=>p+suffix);
 const original=await Promise.all(files.map(p=>ops.readFile(p,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;})));
 let started=false;
 try{
  await Promise.all([ops.writeFile(temps[0],JSON.stringify(posts,null,2)+'\n',{flag:'wx'}),ops.writeFile(temps[1],JSON.stringify(state,null,2)+'\n',{flag:'wx'})]);
  started=true;await ops.rename(temps[0],files[0]);await ops.rename(temps[1],files[1]);
 }catch(error){
  if(started)for(let i=0;i<files.length;i++){if(original[i]===null)await ops.unlink(files[i]).catch(()=>{});else await ops.writeFile(files[i],original[i]);}
  throw error;
 }finally{await Promise.all(temps.map(p=>ops.unlink(p).catch(()=>{})));}
}
async function readJSON(file,fallback) {try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'&&fallback!==undefined)return fallback;throw error;}}
export async function publishFiles({base=root,day=dayInSeoul(),now=new Date(),checkSource}={}) {
 if(!validDay(day))throw new PublicationError('invalid-date','유효한 한국 날짜가 필요합니다.');
 const lockPath=path.join(base,'.publication.lock');let lock;
 try{lock=await fs.open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,at:now.toISOString()}));}
 catch(error){if(error.code==='EEXIST')throw new PublicationError('publication-locked','다른 발행 작업이 진행 중입니다.');throw error;}
 try{
  const postsPath=path.join(base,'docs/data/posts.json'),statePath=path.join(base,'docs/data/publication-state.json');
  const posts=await readJSON(postsPath);if(!Array.isArray(posts))throw new PublicationError('corrupt-store','기존 게시글이 배열이 아닙니다. 저장하지 않습니다.');
  const state=await readJSON(statePath,{schemaVersion:2,days:{}});
  if(!state||typeof state!=='object'||Array.isArray(state)||(state.days&&(typeof state.days!=='object'||Array.isArray(state.days))))throw new PublicationError('corrupt-ledger','발행 이력 형식이 손상되었습니다. 덮어쓰지 않습니다.');
  let result;
  try{
   const bundle=await readJSON(path.join(base,`content/inbox/${day}.json`),{schemaVersion:2,policyVersion:policy.version,date:day,id:`missing-${day}`,drafts:[],holds:[]});
   result=await publishBundle(posts,state,bundle,{day,now,checkSource});
  }catch(error){
   const next=structuredClone(state);next.days ||= {};next.days[day] ||= {date:day,groups:{}};
   const existing=planDay(posts,day,next);
   for(const group of GROUPS)if(existing.groups[group].needsGeneration){const old=next.days[day].groups[group]||{attempts:[]};const attempt={at:now.toISOString(),status:'failed',code:error.code||'invalid-json',message:error.message};next.days[day].groups[group]={...old,...attempt,attempts:[...(old.attempts||[]),attempt]};}
   result={posts,state:next,complete:false,results:GROUPS.map(group=>({group,status:existing.groups[group].needsGeneration?'failed':'skipped',code:error.code||'invalid-json',message:error.message}))};
  }
  await writeDataPair(postsPath,statePath,result.posts,result.state);
  return result;
 }finally{await lock.close();await fs.unlink(lockPath).catch(()=>{});}
}
async function main(){
 const command=process.argv[2]||'plan';const day=process.argv.find(a=>a.startsWith('--date='))?.slice(7)||dayInSeoul();
 if(command==='plan'||command==='check'){
  const posts=await readJSON(path.join(root,'docs/data/posts.json'));const state=await readJSON(path.join(root,'docs/data/publication-state.json'),{});
  console.log(JSON.stringify(planDay(posts,day,state),null,2));return;
 }
 if(command!=='publish')throw Error('Use plan, check or publish');
 const result=await publishFiles({day});
 const report={date:day,complete:result.complete,results:result.results};
 await fs.writeFile(path.join(root,'.publication-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`## ${day} · 발행 결과\n\n${result.results.map(r=>`- ${r.group}: ${r.status}${r.code?' ('+r.code+')':''}`).join('\n')}\n`);
 if(result.results.some(r=>r.status==='failed'))process.exitCode=1;
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.code||'publication-error',error.message);process.exitCode=1;});
