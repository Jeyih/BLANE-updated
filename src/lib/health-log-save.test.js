import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthLogSaver } from './health-log-save.js';
const profile = {id:'test-owner',weight_kg:65};
const values = {weight_kg:65,sleep_hours:0,water_ml:0,calories_burned:0};
function database() {
  const db = { rows:new Map(),calls:[],mode:'ok',profileWeight:65 };
  db.client = {from(table){return {upsert(payload,options){
    db.calls.push({table,payload,options});
    return {async abortSignal(signal){
      const mode=db.mode;
      if(mode==='timeout') return new Promise(resolve=>signal.addEventListener('abort',()=>resolve({error:new Error('aborted')})));
      if(mode==='offline') throw new Error('disconnected');
      await new Promise(resolve=>setTimeout(resolve,1));
      if(table==='health_logs') {
        db.rows.set(`${payload.user_id}:${payload.logged_at}`,payload);
        if(mode==='lost-reply') throw new Error('response dropped after commit');
      } else {
        if(mode==='profile-error') return {error:new Error('profile unavailable')};
        db.profileWeight=payload.weight_kg;
      }
      return {error:null};
    }};
  }}}};
  return db;
}
const options={now:()=>new Date('2026-10-26T16:30:00Z')};
test('double submission shares one write and preserves zero values on the Philippine date',async()=>{
  const db=database(),save=createHealthLogSaver(db.client,options);
  const first=save(profile,values),second=save(profile,values);
  assert.equal(first,second); await first;
  assert.equal(db.calls.length,1); assert.equal(db.rows.size,1);
  const row=[...db.rows.values()][0];
  assert.equal(row.logged_at,'2026-10-27'); assert.equal(row.water_ml,0); assert.equal(row.sleep_hours,0);
  assert.equal(db.calls[0].options.onConflict,'user_id,logged_at');
});
test('retry after a lost response updates the existing daily row instead of duplicating it',async()=>{
  const db=database(),save=createHealthLogSaver(db.client,options);
  db.mode='lost-reply'; await assert.rejects(save(profile,values),/Could not confirm/);
  assert.equal(db.rows.size,1);
  db.mode='ok'; await save(profile,{...values,water_ml:600});
  assert.equal(db.rows.size,1); assert.equal([...db.rows.values()][0].water_ml,600);
});
test('connection loss and timeout release the pending save so reconnection can retry',async()=>{
  for(const mode of ['offline','timeout']) {
    const db=database(),save=createHealthLogSaver(db.client,{...options,timeoutMs:5});
    db.mode=mode; await assert.rejects(save(profile,values),/same daily entry/);
    assert.equal(db.rows.size,0);
    db.mode='ok'; await save(profile,values); assert.equal(db.rows.size,1);
  }
});
test('partial profile failures report the confirmed log and retry without duplicating it',async()=>{
  const db=database(),save=createHealthLogSaver(db.client,options);
  db.mode='profile-error'; await assert.rejects(save(profile,{...values,weight_kg:66}),/Health log saved, but profile weight/);
  db.mode='ok'; const updated=await save(profile,{...values,weight_kg:66});
  assert.equal(db.rows.size,1); assert.equal(updated.weight_kg,66); assert.equal(db.profileWeight,66);
});
test('separate owners never share pending jobs or daily records',async()=>{
  const db=database(),save=createHealthLogSaver(db.client,options);
  await Promise.all([save(profile,values),save({...profile,id:'second-owner'},values)]);
  assert.equal(db.rows.size,2);
  await assert.rejects(save({},values),/Sign in/);
});
