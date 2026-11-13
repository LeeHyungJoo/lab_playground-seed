import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizePost,visiblePosts,queryArticles,parseRoute,routeURL,safeURL,stableId} from '../docs/lib/catalog.mjs';
import {articleDetailView,articleListView,albumsView,albumDetailView,boardView,boardDetailView,escapeHTML} from '../docs/lib/views.mjs';
import {StaticContentRepository} from '../docs/lib/repository.mjs';
const legacy={title:'원래 AI 아티클',category:'AI',date:'2026-11-12',repository:'owner/project',url:'https://github.com/owner/project',summary:'기존 설명을 그대로 유지합니다.',highlights:['기능 하나','기능 둘','기능 셋'],why:'공식 자료를 확인합니다.',kind:'daily'};
test('all legacy categories, content and stable links survive normalization',()=>{
 const n=normalizePost(legacy);assert.equal(n.category,'ai');assert.equal(n.summary,legacy.summary);assert.equal(n.scope,'development');assert.equal(n.sources[0].url,legacy.url);assert.equal(stableId(legacy),normalizePost({...legacy}).id);
 assert.equal(normalizePost({...legacy,category:'개발 도구'}).category,'tools');assert.equal(normalizePost({...legacy,category:'개발도구'}).category,'tools');
 const html=articleDetailView(n,parseRoute('?view=articles'));
 assert.ok(html.includes(legacy.summary));assert.ok(html.includes('기능 하나'));assert.ok(html.includes('공식 자료를 확인합니다.'));
});
test('URL state round-trips scope, category, Korean search and page; legacy hashes remain article routes',()=>{
 const original={view:'articles',scope:'life',category:'health',q:'수면 & 회복',page:2};const route=parseRoute(routeURL(original));for(const key of Object.keys(original))assert.equal(route[key],original[key]);
 assert.equal(parseRoute('', '#board').view,'articles');assert.equal(parseRoute('?view=invalid&category=AI').scope,'development');
 assert.equal(parseRoute('?view=albums&album=sample-family-trip').album,'sample-family-trip');assert.equal(parseRoute('?view=board&post=welcome').post,'welcome');
});
test('filters, search, pagination and scheduled visibility work without mutating data',()=>{
 const data=Array.from({length:13},(_,i)=>normalizePost({...legacy,id:String(i),category:i<10?'AI':'tools',date:'2026-11-12',title:`프로젝트 ${i}`}));
 const health=normalizePost({...legacy,id:'health',category:'health',title:'수면과 회복'});data.push(health);
 const r=queryArticles(data,{scope:'development',page:2,pageSize:9});assert.equal(r.page,2);assert.equal(r.items.length,4);
 const q=queryArticles(data,{scope:'life',category:'health',q:'수면'});assert.equal(q.total,1);assert.equal(q.items[0].id,'health');
 assert.equal(visiblePosts([{...legacy,publishedAt:'2026-11-13T06:00:00+09:00'}],new Date('2026-11-12T20:59:59Z')).length,0);
 assert.equal(visiblePosts([{...legacy,publishedAt:'2026-11-13T06:00:00+09:00'}],new Date('2026-11-12T21:00:00Z')).length,1);
 assert.equal(visiblePosts([{...legacy,status:'draft'}]).length,0);
});
test('untrusted article data and search text are escaped and unsafe source links are excluded',()=>{
 const payload='<img src=x onerror=alert(1)>';const p=normalizePost({...legacy,title:payload,summary:payload,why:payload,sources:[{title:payload,url:'javascript:alert(1)'}]});
 const detail=articleDetailView(p,parseRoute('?view=articles'));assert.ok(!detail.includes(payload));assert.ok(!detail.includes('href="javascript:'));assert.ok(detail.includes('&lt;img'));
 const list=articleListView({...parseRoute('?view=articles'),q:'" autofocus onfocus="alert(1)'},{items:[p],total:1,page:1,pages:1});assert.ok(!list.includes('value="" autofocus'));assert.ok(list.includes('&quot;'));
 assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('https://user:secret@public.org'),null);assert.equal(escapeHTML('<>&"\''),'&lt;&gt;&amp;&quot;&#39;');
});
test('album and board list/detail routes use neutral samples and the exact requested welcome announcement',async()=>{
 const albums=JSON.parse(await readFile(new URL('../docs/data/albums.json',import.meta.url)));const posts=JSON.parse(await readFile(new URL('../docs/data/board.json',import.meta.url)));
 assert.equal(albums.length,4);assert.ok(albums.every(a=>a.isSample&&a.photos.every(p=>p.src.startsWith('assets/placeholder-'))));
 assert.ok(albumsView(albums).includes('album=sample-family-trip'));assert.ok(albumDetailView(albums[0]).includes('실제 사진 아님'));
 assert.equal(posts[0].title,'盡人事待天命에 오신 것을 환영합니다.');assert.equal(posts[0].content.at(-1),'방문해 주셔서 감사합니다.');
 assert.ok(boardView(posts).includes('post=welcome'));assert.ok(boardDetailView(posts[0]).includes('가족의 일상과 소중한 순간'));assert.ok(!boardView(posts).includes('<button'));
});
test('repository adapter can be replaced, uses a snapshot on outages and de-duplicates network reads',async()=>{
 let calls=0;const repo=new StaticContentRepository({remoteBase:'https://remote.org/',localBase:'https://snapshot.org/',fetcher:async url=>{calls++;return url.startsWith('https://remote')?new Response('down',{status:503}):Response.json([legacy]);}});
 const [a,b]=await Promise.all([repo.listArticles(),repo.listArticles()]);assert.deepEqual(a,b);assert.equal(calls,2);assert.equal(repo.usedSnapshot,true);
 repo.clear();await repo.listArticles();assert.equal(calls,4);assert.equal(await repo.getCurrentUser(),null);
 const malformed=new StaticContentRepository({remoteBase:null,localBase:'https://snapshot.org/',fetcher:async()=>Response.json({not:'an array'})});assert.deepEqual(await malformed.listArticles(),[]);
});

test('repository keeps the native browser fetch receiver and distinguishes network failure from an empty archive',async()=>{
 const repo=new StaticContentRepository({remoteBase:null,localBase:'https://snapshot.org/',fetcher:function(){assert.equal(this,globalThis);return Promise.resolve(Response.json([legacy]));}});
 assert.equal((await repo.listArticles()).length,1);assert.equal(repo.failures.size,0);
 const offline=new StaticContentRepository({remoteBase:null,localBase:'https://snapshot.org/',fetcher:async()=>{throw Error('offline');}});
 assert.deepEqual(await offline.listArticles(),[]);assert.equal(offline.failures.has('posts.json'),true);
});
