const defaultRemote='https://raw.githubusercontent.com/LeeHyungJoo/lab_playground-seed/main/docs/data/';
export class StaticContentRepository {
 constructor({remoteBase=defaultRemote,localBase=new URL('../data/',import.meta.url),fetcher=fetch}={}){this.remoteBase=remoteBase;this.localBase=localBase;this.fetcher=fetcher.bind(globalThis);this.failures=new Set();this.cache=new Map();this.usedSnapshot=false;}
 clear(){this.cache.clear();this.failures.clear();this.usedSnapshot=false;}
 async read(name,fallback){
  if(this.cache.has(name))return this.cache.get(name);
  const request=(async()=>{
   const urls=[...(this.remoteBase?[this.remoteBase+name+'?v='+Date.now()]:[]),new URL(name,this.localBase).href];
   for(let i=0;i<urls.length;i++){
    try{const r=await this.fetcher(urls[i],{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)continue;const data=await r.json();if(Array.isArray(fallback)&&!Array.isArray(data))continue;if(!Array.isArray(fallback)&&(!data||typeof data!=='object'||Array.isArray(data)))continue;if(i>0&&this.remoteBase)this.usedSnapshot=true;return data;}catch{}
   }
   this.usedSnapshot=true;this.failures.add(name);return structuredClone(fallback);
  })();this.cache.set(name,request);return request;
 }
 listArticles(){return this.read('posts.json',[]);}
 listAlbums(){return this.read('albums.json',[]);}
 listBoardPosts(){return this.read('board.json',[]);}
 getPublicationState(){return this.read('publication-state.json',{schemaVersion:2,days:{}});}
 async getCurrentUser(){return null;}
}
// Replace this adapter with an API-backed implementation when a DB/NAS is introduced.
export const createRepository=options=>new StaticContentRepository(options);
