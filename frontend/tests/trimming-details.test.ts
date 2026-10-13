import { workDateRange } from "../src/services/workFormValidation.ts";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkForm } from '../src/services/workFormResponse.ts';
import { initialWorkFormValues, editableWorkFormValues, sortWorkFormFields } from '../src/services/workForm.ts';
import handler from '../api/work-form.ts';

test('new trimming details load, appear below trimming status, remain editable and clear independently', () => {
  const form=normalizeWorkForm({cr1da_feederpolesection:'TEST',crf11_trimmingwork:0,crf11_namapegawaicantasan:'Test Officer',crf11_trimmingdate:'2026-10-13T00:00:00Z',cr1da_namapegawaicontractors:'Inspector'},'TEST');
  const names=sortWorkFormFields(form.fields).map(field=>field.name);
  assert.deepEqual(names.slice(names.indexOf('cr1da_fieldtrimmingrequired'),names.indexOf('cr1da_remarksactiontaken')+1),['cr1da_fieldtrimmingrequired','crf11_trimmingwork','crf11_namapegawaicantasan','crf11_trimmingdate','cr1da_remarksactiontaken']);
  const values=initialWorkFormValues(form,{poleId:'TEST'} as any);
  assert.equal(values.crf11_trimmingdate,'2026-10-13');
  assert.equal(values.crf11_namapegawaicantasan,'Test Officer');
  values.crf11_namapegawaicantasan='Updated';values.crf11_trimmingdate='2026-10-12';
  let payload=editableWorkFormValues(form,values);
  assert.equal(payload.crf11_namapegawaicantasan,'Updated');assert.equal(payload.crf11_trimmingdate,'2026-10-12');
  assert.equal(payload.cr1da_namapegawaicontractors,'Inspector');
  values.crf11_namapegawaicantasan='';values.crf11_trimmingdate='';
  payload=editableWorkFormValues(form,values);
  assert.equal(payload.crf11_namapegawaicantasan,null);assert.equal(payload.crf11_trimmingdate,null);
  const blank=normalizeWorkForm({found:false},'TEST');
  assert.equal(blank.fields.find(f=>f.name==='crf11_trimmingdate')?.value,null);
});

test('save endpoint forwards both new fields to the flow, including cleared values', async () => {
  const original=globalThis.fetch;
  const names=['POWER_AUTOMATE_TENANT_ID','POWER_AUTOMATE_CLIENT_ID','POWER_AUTOMATE_CLIENT_SECRET','POWER_AUTOMATE_GET_POLES_URL','POWER_AUTOMATE_SAVE_WORK_FORM_URL'];
  const old=names.map(name=>process.env[name]);
  names.forEach(name=>process.env[name]=name.endsWith('_URL')?'https://example.invalid/'+name:'test');
  let submitted:any;
  try {
    globalThis.fetch=async(url,options)=>{
      if(String(url).includes('login.microsoftonline.com'))return Response.json({access_token:'test'});
      if(String(url).includes('GET_POLES'))return Response.json([{cr1da_poleidentifier:'TEST'}]);
      submitted=JSON.parse(String(options?.body));return Response.json({ok:true});
    };
    for(const [name,date] of [['Officer',workDateRange().today],[null,null]]) {
      const res:any={code:0,status(code:number){this.code=code;return this;},json(){return this;}};
      await handler({method:'PUT',query:{poleId:'TEST'},body:{values:{cr1da_inspectionstatus:0,cr1da_risklevel:0,cr1da_namapegawaicontractors:'Inspector',cr1da_inspectiondate:workDateRange().today,cr1da_aiconfirmedenroachment:0,cr1da_fieldtrimmingrequired:0,crf11_trimmingwork:0,crf11_namapegawaicantasan:name,crf11_trimmingdate:date}}},res);
      assert.equal(res.code,200);assert.equal(submitted.namaPegawaiCantasan,name);assert.equal(submitted.trimmingDate,date);
    }
  } finally {globalThis.fetch=original;names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];});}
});
