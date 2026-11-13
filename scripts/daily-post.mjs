import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {dayInSeoul,hasPublication} from '../docs/lib/catalog.mjs';
import {policy} from './publication.mjs';
import {publishFiles} from './publication-cli.mjs';
import { summarize } from './ai-summary.mjs';
const file = new URL('../docs/data/posts.json', import.meta.url);
export {dayInSeoul};
export const hasDailyPost = (posts,day=dayInSeoul()) => hasPublication(posts,day,'development');
export function selectRepo(items, posts) {
 const used = new Set(posts.map(p=>p.repository));
 return items.filter(r=>!r.archived && !r.fork && !used.has(r.full_name)).sort((a,b)=>b.stargazers_count-a.stargazers_count)[0];
}
async function github(path) {
 const r=await fetch(`https://api.github.com/${path}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'morning-code-lab',...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})},signal:AbortSignal.timeout(30000)});
 if(!r.ok) throw new Error(`GitHub ${r.status}`); return r.json();
}
export async function generateDevelopment(posts, today=dayInSeoul()) {
 const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
 const batches=await Promise.all(['llm','artificial-intelligence','developer-tools'].map(topic=>github(`search/repositories?q=${encodeURIComponent(`topic:${topic} pushed:>=${since} stars:>=100 archived:false`)}&sort=updated&order=desc&per_page=40`)));
 const pool=[...new Map(batches.flatMap(b=>b.items).map(r=>[r.full_name,r])).values()];
 const recent=pool.filter(r=>r.created_at.slice(0,10)>=since);
 const repo=selectRepo(recent,posts)||selectRepo(pool,posts);
 if(!repo)throw new Error('No new qualifying repository; no post was published');
 let readme='';try{const r=await github(`repos/${repo.full_name}/readme`);readme=Buffer.from(r.content,'base64').toString('utf8').slice(0,10000);}catch{}
 const {content,provider,model}=await summarize({name:repo.full_name,description:repo.description,language:repo.language,topics:repo.topics,readme});
 return {title:content.title,summary:content.summary,why:content.why,highlights:content.highlights,category:content.category==='개발 도구'?'tools':'ai',date:today,repository:repo.full_name,url:repo.html_url,stars:repo.stargazers_count,language:repo.language||'기타',createdAt:repo.created_at,pushedAt:repo.pushed_at,generatedAt:new Date().toISOString(),kind:'daily',status:'draft',publicationGroup:'development',provider,model};
}
export async function run() {
 const posts=JSON.parse(await readFile(file,'utf8'));const today=dayInSeoul();
 if(hasDailyPost(posts,today)){console.log('Development already posted today');return;}
 const draft=await generateDevelopment(posts,today);
 const inbox=new URL(`../content/inbox/${today}.json`,import.meta.url);
 let bundle;try{bundle=JSON.parse(await readFile(inbox,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;bundle={schemaVersion:2,policyVersion:policy.version,date:today,drafts:[],holds:[]};}
 bundle.drafts=[...bundle.drafts.filter(p=>p.publicationGroup!=='development'),draft];
 await mkdir(new URL('../content/inbox/',import.meta.url),{recursive:true});await writeFile(inbox,JSON.stringify(bundle,null,2)+'\n');
 const result=await publishFiles({day:today});
 console.log(JSON.stringify(result.results));
 if(!result.results.some(r=>r.group==='development'&&['published','skipped'].includes(r.status)))throw Error('Development validation failed; see publication-state.json');
}
if(process.argv[1]===new URL(import.meta.url).pathname) await run();
