import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import handler from '../api/work-feedback.ts';
import { feedbackFromWorkForm, normalizeWorkForm } from '../src/services/workFormResponse.ts';

const row = { cr1da_feederpolesection: 'P1', crf11_trimmingwork: 1,
  'crf11_trimmingwork@OData.Community.Display.V1.FormattedValue': 'Completed',
  cr1da_lvvmmodelid: 'record-id', '@odata.etag': 'W/"2"', modifiedon: '2026-09-23T00:00:00Z',
  cr1da_inspectiondate: '2026-09-23T00:00:00Z', cr1da_remarksactiontaken: 'Inspected' };

test('raw records and not-found responses normalize without inventing choice codes', () => {
  assert.equal(feedbackFromWorkForm(row, 'P1')[0].trimmingWork, 'Completed');
  assert.deepEqual(feedbackFromWorkForm({found:false}, 'P1'), []);
  assert.throws(() => feedbackFromWorkForm({...row, cr1da_feederpolesection:'P2'}, 'P1'), /different pole/);
  assert.equal(feedbackFromWorkForm({crf11_trimmingwork:1}, 'P1')[0].trimmingWork, 'In Progress');
  assert.throws(() => feedbackFromWorkForm({crf11_trimmingwork:99}, 'P1'), /formatted label/);
  const form = normalizeWorkForm(row,'P1');
  assert.equal(form.id,'record-id'); assert.equal(form.version,'W/"2"');
  assert.equal(form.fields.find(f=>f.name==='cr1da_inspectiondate')?.value,'2026-09-23');
  assert.notEqual(form.fields.find(f=>f.name==='crf11_trimmingwork')?.readOnly,true);
  assert.equal(form.fields.find(f=>f.name==='crf11_trimmingwork')?.value,1);
  assert.equal(normalizeWorkForm({found:false},'P1').fields[0].value,'P1');
});

test('feedback route requires and sends poleId to the existing GetWorkForm flow', async () => {
  const oldFetch=globalThis.fetch, oldUrl=process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
  async function invoke(query: object) {
    const res:any={code:0,body:null,status(c:number){this.code=c;return this;},json(b:unknown){this.body=b;return this;}};
    await handler({method:'GET',query},res);return res;
  }
  try {
    assert.equal((await invoke({})).code,400);
    process.env.POWER_AUTOMATE_GET_WORK_FORM_URL='https://example.invalid/read';
    globalThis.fetch=async (url,options)=>{
      assert.equal(url,'https://example.invalid/read');
      assert.deepEqual(JSON.parse(String(options?.body)),{poleId:'P1'});
      return Response.json(row);
    };
    const response=await invoke({poleId:'P1'});
    assert.equal(response.code,200); assert.equal(response.body[0].trimmingWork,'Completed');
    globalThis.fetch=async()=>Response.json({found:false});
    assert.deepEqual((await invoke({poleId:'P1'})).body,[]);
    globalThis.fetch=async()=>new Response('',{status:400});
    assert.equal((await invoke({poleId:'P1'})).code,502);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
    else process.env.POWER_AUTOMATE_GET_WORK_FORM_URL=oldUrl;
  }
});

test('dashboard requests are deduplicated, bounded, cached, and fail instead of returning partial totals', async () => {
  const source=await readFile(new URL('../src/services/api.ts',import.meta.url),'utf8');
  const adapter=new URL('../src/services/workFormResponse.ts',import.meta.url).href;
  const compiled=ts.transpileModule(source.replace('"./workFormResponse"',JSON.stringify(adapter)).replaceAll('import.meta.env','({})'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  const oldFetch=globalThis.fetch;
  let active=0,max=0,calls=0;
  try {
    globalThis.fetch=async(url)=>{
      active++;calls++;max=Math.max(max,active);
      await new Promise(resolve=>setTimeout(resolve,5));active--;
      const poleId=new URL(String(url),'https://example.invalid').searchParams.get('poleId');
      return Response.json([{poleId,trimmingWork:'Completed',modifiedOn:null}]);
    };
    const ids=Array.from({length:9},(_,i)=>'P'+i);
    assert.equal((await api.getWorkFeedback([...ids,'P0'])).length,9);
    assert.equal(calls,9);assert.equal(max,4);
    await api.getWorkFeedback(ids);assert.equal(calls,9);
    api.invalidateWorkFeedback();
    globalThis.fetch=async()=>Response.json({message:'Flow failed'},{status:502});
    await assert.rejects(api.getWorkFeedback(ids),/Flow failed/);
    const controller=new AbortController();controller.abort();
    await assert.rejects(api.getWorkFeedback(ids,controller.signal),{name:'AbortError'});
  }finally{globalThis.fetch=oldFetch;}
});

test('server plain-text failures produce a readable error instead of a JSON syntax error', async () => {
  const source=await readFile(new URL('../src/services/api.ts',import.meta.url),'utf8');
  const adapter=new URL('../src/services/workFormResponse.ts',import.meta.url).href;
  const compiled=ts.transpileModule(source.replace('"./workFormResponse"',JSON.stringify(adapter)).replaceAll('import.meta.env','({})'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled+'\n//error-test').toString('base64'));
  const oldFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED',{status:500});
    await assert.rejects(api.getWorkFeedback(['P1']),/HTTP 500/);
    await assert.rejects(api.getWorkForm('P1'),/HTTP 500/);
  }finally{globalThis.fetch=oldFetch;}
});

test('field work pack and form buttons remain available while feedback loads or fails', async () => {
  const React=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  let source=await readFile(new URL('../src/pages/FieldTeamPage.tsx',import.meta.url),'utf8');
  source=source.replace(/import \{ WorkFormModal \}[^;]+;/,'const WorkFormModal = () => null;')
    .replace(/import \{ GeospatialAnalysis \}[^;]+;/,'const GeospatialAnalysis = () => null;')
    .replace(/import \{ PoleDetailsModal \}[^;]+;/,'const PoleDetailsModal = () => null;')
    .replace('"../services/trimmingWork"',JSON.stringify(new URL('../src/services/trimmingWork.ts',import.meta.url).href));
  let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  compiled=compiled.replaceAll('"react"',JSON.stringify(import.meta.resolve('react'))).replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const {FieldTeamPage}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  for(const state of [{feedbackLoading:true,feedbackError:null},{feedbackLoading:false,feedbackError:'HTTP 500'}]){
    const html=renderToStaticMarkup(React.createElement(FieldTeamPage,{
      poles:[{poleId:'P1',finalAiRiskCategory:'HIGH',finalAiRiskScore:70}],workFeedback:[],isLoading:false,error:null,
      onWorkFormSaved:async()=>{},onRefreshFeedback:()=>{},...state,
    }));
    assert.match(html,/>Form<\/button>/);
    assert.match(html,/Trimming work: Unavailable/);
    assert.doesNotMatch(html,/Trimming work: Pending/);
  }
});

test('assessment details override saved work details and a missing street is excluded from submitted edits', async () => {
  const {initialWorkFormValues,editableWorkFormValues}=await import('../src/services/workForm.ts');
  const form=normalizeWorkForm({...row,cr1da_feederid:'Old feeder',cr1da_zone:'Old street',cr1da_gpsautocapture:'1',cr1da_gambaraireference:'2'},'P1');
  const pole:any={poleId:'P1',feederId:'Current feeder',streetName:null,latitude:3.2,longitude:101.4};
  const values=initialWorkFormValues(form,pole);
  assert.equal(values.cr1da_feederid,'Current feeder');
  assert.equal(values.cr1da_zone,'');
  assert.equal(values.cr1da_gpsautocapture,'3.2');
  assert.equal(values.cr1da_gambaraireference,'101.4');
  values.cr1da_remarksactiontaken='New remarks';
  const payload=editableWorkFormValues(form,values);
  assert.equal(payload.cr1da_remarksactiontaken,'New remarks');
  for(const name of ['cr1da_feederpolesection','cr1da_feederid','cr1da_zone','cr1da_gpsautocapture','cr1da_gambaraireference'])assert.equal(name in payload,false);
});

test('all five supplied choice mappings are editable and submit numeric values including zero', async () => {
  const {workFormChoices}=await import('../src/services/workFormResponse.ts');
  const {initialWorkFormValues,editableWorkFormValues,isLockedField}=await import('../src/services/workForm.ts');
  const form=normalizeWorkForm({found:false},'P1');
  const values=initialWorkFormValues(form,{poleId:'P1',streetName:null} as any);
  const expected:Record<string,number[]>={cr1da_aiconfirmedenroachment:[0,1,2],cr1da_fieldtrimmingrequired:[0,1],crf11_trimmingwork:[0,1,2],cr1da_inspectionstatus:[0,1,2,3,4],cr1da_risklevel:[0,1,2,3]};
  for(const [name,codes] of Object.entries(expected)){
    const field=form.fields.find(f=>f.name===name)!;
    assert.equal(field.type,'choice');assert.equal(isLockedField(field),false);
    assert.deepEqual(workFormChoices[name].map(o=>o.value),codes);
    for(const code of codes){
      values[name]=code;
      assert.equal(editableWorkFormValues(form,values)[name],code);
    }
  }
  assert.equal('cr1da_zone' in editableWorkFormValues(form,values),false);
  const existing=normalizeWorkForm({...row,cr1da_fieldtrimmingrequired:false,cr1da_inspectionstatus:0},'P1');
  assert.equal(existing.fields.find(f=>f.name==='cr1da_fieldtrimmingrequired')?.value,0);
  assert.equal(existing.fields.find(f=>f.name==='cr1da_inspectionstatus')?.value,0);
});

test('save flow gets numeric choices intact and exposes upstream error codes without reporting success', async () => {
  const {default:saveHandler}=await import('../api/work-form.ts');
  const oldFetch=globalThis.fetch,oldUrl=process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL;
  const values={cr1da_inspectionstatus:0,cr1da_fieldtrimmingrequired:1,crf11_trimmingwork:2};
  async function invoke(input:unknown=values){
    const res:any={code:0,body:null,status(c:number){this.code=c;return this;},json(b:unknown){this.body=b;return this;}};
    await saveHandler({method:'PUT',query:{poleId:'P1'},body:{id:'record-id',version:'W/"2"',values:input}},res);return res;
  }
  try{
    process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL='https://example.invalid/save';
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://example.invalid/save');
      assert.deepEqual(JSON.parse(String(options?.body)),{poleId:'P1',id:'record-id',version:'W/"2"',values});
      return Response.json({error:{code:'TriggerInputSchemaMismatch'}},{status:400});
    };
    const result=await invoke();assert.equal(result.code,502);assert.match(result.body.message,/HTTP 400 \(TriggerInputSchemaMismatch\)/);
    globalThis.fetch=async()=>Response.json({success:false});
    assert.equal((await invoke()).code,502);
    globalThis.fetch=async()=>new Response(null,{status:204});
    assert.equal((await invoke()).code,200);
    assert.equal((await invoke([])).code,400);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL;else process.env.POWER_AUTOMATE_SAVE_WORK_FORM_URL=oldUrl;
  }
});
