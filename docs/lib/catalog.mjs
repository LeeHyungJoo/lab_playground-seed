export const CATEGORIES = Object.freeze({
 ai:{label:'AI',scope:'development',publicationGroup:'development'},
 tools:{label:'개발도구',scope:'development',publicationGroup:'development'},
 news:{label:'소식',scope:'life',publicationGroup:'news'},
 philosophy:{label:'철학',scope:'life',publicationGroup:'culture'},
 economy:{label:'경제',scope:'life',publicationGroup:'culture'},
 health:{label:'건강',scope:'life',publicationGroup:'culture'}
});
export const PUBLICATION_GROUPS = ['development','news','culture'];
const aliases = {'AI':'ai','ai':'ai','개발 도구':'tools','개발도구':'tools','tools':'tools','developer-tools':'tools','소식':'news','철학':'philosophy','경제':'economy','건강':'health'};
export const categoryId = value => CATEGORIES[value] ? value : aliases[value] || null;
export const dayInSeoul = (date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const normalizeText = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
export function stableId(post) {
 if(post.id) return post.id;
 const key=post.repository || normalizeText(post.title);
 return `legacy-${post.date||'undated'}-${key.replace(/[^\p{L}\p{N}]+/gu,'-')}`;
}
export function publicationGroup(post) {return CATEGORIES[categoryId(post.category)]?.publicationGroup || null;}
export function isDaily(post) {return post.kind!=='test'&&post.kind!=='initial'&&post.status!=='held'&&post.status!=='failed'&&post.status!=='draft';}
export function hasPublication(posts,day,group) {return posts.some(p=>p.date===day&&isDaily(p)&&publicationGroup(p)===group);}
export function articleText(post) {
 const body=Array.isArray(post.content)?post.content.flatMap(s=>[s.heading,...(s.paragraphs||[]),...(s.bullets||[])]).join(' '):String(post.content||'');
 return [post.title,post.summary,body,...(post.highlights||[]),post.why||''].join(' ');
}
export const characterCount=post=>articleText(post).replace(/\s/g,'').length;
export const readingMinutes=post=>Math.max(1,Math.ceil(characterCount(post)/500));
export function normalizePost(post) {
 const category=categoryId(post.category)||'tools';
 return {...post,id:stableId(post),category,scope:CATEGORIES[category].scope,publicationGroup:CATEGORIES[category].publicationGroup,readingMinutes:readingMinutes(post),status:post.status||'published',sources:post.sources||[{title:post.repository?'공식 저장소':'원문',url:post.sourceUrl||post.url}].filter(s=>s.url)};
}
export function visiblePosts(posts, now=new Date()) {
 return posts.map(normalizePost).filter(p=>p.status==='published'&&(!p.publishedAt||Date.parse(p.publishedAt)<=now.getTime())).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.generatedAt||'').localeCompare(a.generatedAt||'')||a.id.localeCompare(b.id));
}
export function queryArticles(posts, {scope='all',category='all',q='',page=1,pageSize=9}={}) {
 const term=String(q).trim().normalize('NFKC').toLowerCase();
 const filtered=posts.filter(p=>(scope==='all'||p.scope===scope)&&(category==='all'||p.category===category)&&(!term||[p.title,p.summary,p.repository,...(p.keywords||[])].join(' ').normalize('NFKC').toLowerCase().includes(term)));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));const current=Math.min(pages,Math.max(1,Number.parseInt(page,10)||1));
 return {items:filtered.slice((current-1)*pageSize,current*pageSize),total:filtered.length,page:current,pages};
}
export function parseRoute(search='', hash='') {
 const p=new URLSearchParams(search);const view=['articles','albums','board'].includes(p.get('view'))?p.get('view'):'articles';
 let scope=['all','development','life'].includes(p.get('scope'))?p.get('scope'):'all';
 let category=categoryId(p.get('category'))||'all';
 if(category!=='all')scope=CATEGORIES[category].scope;
 return {view,scope,category,q:p.get('q')||'',page:Math.max(1,parseInt(p.get('page'),10)||1),article:p.get('article'),album:p.get('album'),post:p.get('post'),anchor:hash};
}
export function routeURL(route) {
 const p=new URLSearchParams();p.set('view',route.view||'articles');
 for(const key of ['scope','category','q','article','album','post'])if(route[key]&&route[key]!=='all')p.set(key,route[key]);
 if(Number(route.page)>1)p.set('page',route.page);
 return `?${p}`;
}
export function safeURL(value) {
 try {const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 return null;
}
