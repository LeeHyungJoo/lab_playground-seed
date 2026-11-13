import {CATEGORIES,visiblePosts,parseRoute,routeURL,queryArticles} from './lib/catalog.mjs';
import {createRepository} from './lib/repository.mjs';
import {articleListView,articleDetailView,albumsView,albumDetailView,boardView,boardDetailView,notFoundView} from './lib/views.mjs';
const repository=createRepository();
const main=document.getElementById('main');let state={articles:[],albums:[],board:[],publication:{}};let loading=false;
const brand='진인사대천명';
function metadata(title,description){
 document.title=title?`${title} · ${brand}`:brand;
 const entries=[['name','description',description],['property','og:title',document.title],['property','og:description',description],['property','og:url',location.href],['name','twitter:title',document.title],['name','twitter:description',description]];
 for(const [attr,key,value] of entries){const element=document.querySelector(`meta[${attr}="${key}"]`);if(element)element.content=value;}
 document.querySelector('link[rel=canonical]').href=location.origin+location.pathname+location.search;
}
function render({focus=false,scroll=false}={}){
 const route=parseRoute(location.search,location.hash);const articles=visiblePosts(state.articles);let title='',description='하루를 기록하고, 생각을 나누는 공간. 가족의 일상과 지식, 오래 남을 생각을 모읍니다.';
 if(route.view==='articles'){
  if(route.article){const post=articles.find(p=>p.id===route.article);main.innerHTML=post?articleDetailView(post,route):notFoundView(route.view);if(post){title=post.title;description=post.summary;}}
  else {const result=queryArticles(articles,route);main.innerHTML=articleListView({...route,page:result.page},result,{albums:state.albums,board:state.board,state:state.publication});if(route.category!=='all')title=CATEGORIES[route.category].label;else if(route.scope!=='all')title=route.scope==='development'?'개발 아티클':'삶의 아티클';}
 }else if(route.view==='albums'){
  const album=state.albums.find(a=>a.id===route.album);main.innerHTML=route.album?(album?albumDetailView(album):notFoundView(route.view)):albumsView(state.albums);title=album?.title||'사진첩';
 }else{
  const post=state.board.find(p=>p.id===route.post);main.innerHTML=route.post?(post?boardDetailView(post):notFoundView(route.view)):boardView(state.board);title=post?.title||'게시판';
 }
 if(repository.usedSnapshot){const note=document.createElement('p');note.className='snapshot-notice';note.textContent='연결이 원활하지 않아 저장된 기록을 표시하고 있습니다.';main.append(note);}
 for(const link of document.querySelectorAll('[data-nav]')){if(link.dataset.nav===route.view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 metadata(title,description);
 if(scroll)window.scrollTo({top:0,behavior:'instant'});
 if(focus)main.focus({preventScroll:true});
}
async function load({refresh=false}={}){
 if(loading)return;loading=true;
 if(refresh)repository.clear();
 try{const [articles,albums,board,publication]=await Promise.all([repository.listArticles(),repository.listAlbums(),repository.listBoardPosts(),repository.getPublicationState()]);if(repository.failures.has('posts.json')&&!state.articles.length)throw Error('Article request failed');state={articles:repository.failures.has('posts.json')?state.articles:articles,albums,board,publication};render();}
 catch{main.innerHTML='<div class="empty"><h1>기록을 불러오지 못했습니다.</h1><p>잠시 후 다시 확인해 주세요.</p><button class="text-button" id="refresh-articles" type="button">다시 불러오기</button></div>';}
 finally{loading=false;}
}
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-route]');
 if(link&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();const next=new URL(link.href);if(next.origin!==location.origin)return;history.pushState({},'',next.pathname+next.search+next.hash);render({focus:true,scroll:true});}
 if(event.target.closest('#refresh-articles')){event.target.disabled=true;event.target.textContent='확인 중…';load({refresh:true});}
});
document.addEventListener('submit',event=>{if(event.target.id!=='search-form')return;event.preventDefault();const route=parseRoute(location.search);const query=new FormData(event.target).get('q');history.pushState({},'',routeURL({...route,q:String(query||''),page:1,article:null}));render({focus:true});});
window.addEventListener('popstate',()=>render({focus:true}));
document.getElementById('year').textContent=new Date().getFullYear();
await load();
