// CI-only transaction: recompute against current main after any rejected push.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('This transaction runner is for an isolated GitHub Actions checkout only. Use publication-cli.mjs locally.');
function git(args,{check=true,capture=false}={}){
 const result=spawnSync('git',args,{encoding:'utf8',stdio:capture?'pipe':'inherit'});
 if(check&&result.status!==0)throw Error(`git ${args[0]} failed`);return result;
}
git(['config','user.name','jininsa-publication-bot']);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
for(let attempt=1;attempt<=3;attempt++){
 git(['fetch','origin','main']);
 // No authoring work lives in this disposable CI checkout. Remote main is authoritative.
 git(['reset','--hard','origin/main']);
 const tests=spawnSync(process.execPath,['--test',...readdirSync('scripts').filter(name=>name.endsWith('.test.mjs')).map(name=>`scripts/${name}`)],{stdio:'inherit'});
 if(tests.status!==0)process.exit(tests.status||1);
 const args=['scripts/publication-cli.mjs','publish'];
 if(process.env.PUBLICATION_DATE)args.push(`--date=${process.env.PUBLICATION_DATE}`);
 const publication=spawnSync(process.execPath,args,{stdio:'inherit'});
 git(['add','docs/data/posts.json','docs/data/publication-state.json']);
 if(git(['diff','--cached','--quiet'],{check:false,capture:true}).status===0)process.exit(publication.status||0);
 git(['commit','-m','content: publish validated daily article groups']);
 const pushed=git(['push','origin','HEAD:main'],{check:false});
 if(pushed.status===0)process.exit(publication.status||0);
 console.warn(`Remote changed during publication; recomputing transaction (${attempt}/3).`);
}
throw Error('Could not commit publication after three compare-and-retry attempts. Remote data was preserved.');
