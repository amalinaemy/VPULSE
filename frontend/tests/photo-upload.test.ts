import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/work-form.ts';
import { workDateRange } from '../src/services/workFormValidation.ts';
import { editableWorkFormValues } from '../src/services/workForm.ts';
import { normalizeWorkForm } from '../src/services/workFormResponse.ts';

test('both photos reach their correct columns and success requires upload confirmation', async()=>{
 const names=['POWER_AUTOMATE_TENANT_ID','POWER_AUTOMATE_CLIENT_ID','POWER_AUTOMATE_CLIENT_SECRET','POWER_AUTOMATE_GET_POLES_URL','POWER_AUTOMATE_SAVE_WORK_FORM_URL'];
 const old=names.map(n=>process.env[n]);const original=globalThis.fetch;
 names.forEach(n=>process.env[n]=n.endsWith('_URL')?'https://example.invalid/'+n:'test');
 const columns=['cr1da_gambarsemasaditapak','crf11_gambarselepasditapak'];
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
 const values={cr1da_inspectionstatus:0,cr1da_risklevel:0,cr1da_namapegawaicontractors:'Test',cr1da_inspectiondate:workDateRange().today,cr1da_aiconfirmedenroachment:0,cr1da_fieldtrimmingrequired:1,crf11_trimmingwork:1,...Object.fromEntries(columns.map(c=>[c,photo]))};
 let confirmed=true;
 try {
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('login.microsoftonline.com'))return Response.json({access_token:'test'});
   if(String(url).includes('GET_POLES'))return Response.json([{cr1da_poleidentifier:'TEST'}]);
   const payload=JSON.parse(String(options?.body));
   assert.deepEqual(payload.images.map((image:any)=>image.column),columns);
   for(const image of payload.images){assert.equal(image.contentBase64,photo.split(',')[1]);assert.equal(image.contentType,'image/png');assert.equal(payload.values[image.column],undefined);}
   return Response.json({success:true,uploadedImageColumns:confirmed?columns:[]});
  };
  for(const expected of [200,502]){
   const res:any={code:0,status(code:number){this.code=code;return this;},json(){return this;}};
   await handler({method:'PUT',query:{poleId:'TEST'},body:{values}},res);assert.equal(res.code,expected);confirmed=false;
  }
  const form=normalizeWorkForm({cr1da_feederpolesection:'TEST',...Object.fromEntries(columns.map(c=>[c,photo]))},'TEST');
  const unchanged=editableWorkFormValues(form,Object.fromEntries(form.fields.map(f=>[f.name,f.value])));
  for(const column of columns)assert.equal(column in unchanged,false);
 }finally{globalThis.fetch=original;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i];});}
});
