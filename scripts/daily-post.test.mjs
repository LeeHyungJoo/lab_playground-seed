import test from 'node:test';
import assert from 'node:assert/strict';
import {dayInSeoul,selectRepo,hasDailyPost} from './daily-post.mjs';
test('Korea date crosses at 15 UTC',()=>{assert.equal(dayInSeoul(new Date('2026-11-08T14:59:00Z')),'2026-11-08');assert.equal(dayInSeoul(new Date('2026-11-08T15:00:00Z')),'2026-11-09');});
test('exclude repeats, forks, archives and select by stars',()=>{const r=(name,stars,other={})=>({full_name:name,stargazers_count:stars,...other});assert.equal(selectRepo([r('old',999),r('fork',900,{fork:true}),r('archived',800,{archived:true}),r('next',100),r('best',200)],[{repository:'old'}]).full_name,'best');assert.equal(selectRepo([],[]),undefined);});

test('recovery schedules skip completed days but allow missing days and test-only days',()=>{
 const today='2026-11-09';
 assert.equal(hasDailyPost([{date:today,kind:'daily',category:'AI'}],today),true);
 assert.equal(hasDailyPost([{date:'2026-11-08',kind:'daily'}],today),false);
 assert.equal(hasDailyPost([{date:today,kind:'test'},{date:today,kind:'initial'}],today),false);
 assert.equal(hasDailyPost([],today),false);
});
