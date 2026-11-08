import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSummary,summarize} from './ai-summary.mjs';
const valid={title:'테스트 기술',summary:'공식 자료를 요약합니다.',why:'모델별 조건을 확인하세요.',highlights:['첫 번째 기능','두 번째 기능','세 번째 기능'],category:'AI'};
test('reject service health responses and non-Korean model output',()=>{
 assert.throws(()=>parseSummary('OK'));
 assert.throws(()=>parseSummary(JSON.stringify({...valid,summary:'Not a Korean summary'})));
 assert.throws(()=>parseSummary(JSON.stringify({...valid,highlights:['하나']})));
 assert.deepEqual(parseSummary('```json\n'+JSON.stringify(valid)+'\n```'),valid);
});
test('OpenAI transport rejects invalid and failed responses without exposing credentials',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-placeholder';
 try {
  await assert.rejects(()=>summarize({}, {fetcher:async()=>new Response('OK')}),/non-JSON/);
  await assert.rejects(()=>summarize({}, {fetcher:async()=>new Response('sensitive body',{status:401})}),/HTTP 401/);
  const result=await summarize({}, {fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify(valid)}}]})});
  assert.equal(result.provider,'openai');assert.deepEqual(result.content,valid);
 } finally { if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old; }
});
