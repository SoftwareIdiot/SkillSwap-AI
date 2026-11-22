import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReward, normalizeRewards, rewardStatus, rewardDay } from "../lib/rewards.ts";
const now = new Date("2026-11-14T20:00:00Z");
const activity = [{id:"task",label:"Completed: Python practice",date:now.toISOString()}];
test("daily rewards use the saved timezone and cannot be collected twice", () => {
  const r = applyReward(activity,normalizeRewards(),{type:"reward.collect",zone:"Asia/Kolkata"},now);
  assert.deepEqual(r.days,["2026-11-15"]);
  const twice = applyReward(activity,r,{type:"reward.collect",zone:"America/New_York"},now);
  assert.equal(twice.zone,"Asia/Kolkata");
  assert.equal(rewardStatus(activity,twice,now).balance,10);
  assert.equal(rewardDay("2026-03-08T07:00:00Z","America/New_York"),"2026-03-08");
});
test("logins, profile changes and tiny focus sessions do not earn Sparks", () => {
  for(const label of ["Signed in","Published: profile","Completed 1 minutes of focus","Completed a daily habit"]){
    assert.throws(() => applyReward([{...activity[0],label}],normalizeRewards(),{type:"reward.collect",zone:"UTC"},now),/Complete/);
  }
});
test("cosmetics require sufficient balance, charge once and stay owned", () => {
  const base = normalizeRewards({zone:"UTC",days:["2026-11-10","2026-11-11","2026-11-12","2026-11-13"]});
  assert.throws(() => applyReward([],normalizeRewards(),{type:"reward.buy",item:"aurora"},now),/more Sparks/);
  const bought = applyReward([],base,{type:"reward.buy",item:"aurora"},now);
  assert.equal(bought.spent,40);
  assert.equal(applyReward([],bought,{type:"reward.buy",item:"aurora"},now).spent,40);
  assert.throws(() => applyReward([],bought,{type:"reward.equip",item:"orbit"},now),/Unlock/);
  assert.equal(applyReward([],bought,{type:"reward.equip",item:"aurora"},now).theme,"aurora");
  assert.equal(base.spent,0);
});
test("streak save bridges yesterday only without adding a rewarded day", () => {
  const base=normalizeRewards({zone:"UTC",days:["2026-11-10","2026-11-11","2026-11-12"]});
  const saved=applyReward(activity,base,{type:"reward.buy",item:"save"},now);
  assert.equal(rewardStatus(activity,saved,now).streak,5);
  assert.equal(rewardStatus(activity,saved,now).balance,0);
  assert.equal(saved.days.length,3);
  assert.deepEqual(saved.protectedDays,["2026-11-13"]);
  assert.throws(() => applyReward(activity,saved,{type:"reward.buy",item:"save"},now),/yesterday/);
  assert.throws(() => applyReward([],normalizeRewards({zone:"UTC",days:["2026-11-01","2026-11-02","2026-11-03"]}),{type:"reward.buy",item:"save"},now),/yesterday/);
});
