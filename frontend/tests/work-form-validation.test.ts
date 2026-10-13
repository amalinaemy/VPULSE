import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkForm, workDateRange } from '../src/services/workFormValidation.ts';
import handler from '../api/work-form.ts';
const now=new Date('2026-10-13T16:01:00Z');
const valid={cr1da_inspectionstatus:0,cr1da_risklevel:0,cr1da_namapegawaicontractors:'Officer',cr1da_inspectiondate:'2026-10-14',cr1da_aiconfirmedenroachment:0,cr1da_fieldtrimmingrequired:false,crf11_trimmingwork:0};
test('Malaysia date boundaries allow today and yesterday, rejecting older/future/invalid dates',()=>{
 assert.deepEqual(workDateRange(now),{today:'2026-10-14',yesterday:'2026-10-13'});
 assert.deepEqual(workDateRange(new Date('2026-12-31T16:00:00Z')),{today:'2027-01-01',yesterday:'2026-12-31'});
 for(const date of ['2026-10-14','2026-10-13'])assert.deepEqual(validateWorkForm({...valid,cr1da_inspectiondate:date,crf11_trimmingdate:date},now),{});
 for(const date of ['2026-10-12','2026-10-15','bad']){
  const errors=validateWorkForm({...valid,cr1da_inspectiondate:date,crf11_trimmingdate:date},now);
  assert.ok(errors.cr1da_inspectiondate);assert.ok(errors.crf11_trimmingdate);
 }
});
test('all seven fields are required, whitespace is empty, zero and No are valid',()=>{
 assert.equal(Object.keys(validateWorkForm({},now)).length,7);
 assert.deepEqual(validateWorkForm(valid,now),{});
 assert.match(validateWorkForm({...valid,cr1da_namapegawaicontractors:'  '},now).cr1da_namapegawaicontractors,/Rondaan/);
});
test('invalid form is rejected before any flow or authentication call',async()=>{
 const old=process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL;process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL='https://example.invalid/save';
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=async()=>{called=true;throw Error('unexpected network');};
 try{
  const res:any={code:0,body:null,status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;}};
  await handler({method:'PUT',query:{poleId:'TEST'},body:{values:{}}},res);
  assert.equal(res.code,400);assert.equal(called,false);assert.equal(Object.keys(res.body.fieldErrors).length,7);
 }finally{globalThis.fetch=original;if(old===undefined)delete process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL;else process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL=old;}
});
