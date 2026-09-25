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
    assert.equal(calls,9);assert.equal(max,2);
    await api.getWorkFeedback(ids);assert.equal(calls,9);
    api.invalidateWorkFeedback();
    let attempts = 0;
    globalThis.fetch=async()=> ++attempts === 1
      ? Response.json({message:'Temporary outage',retryable:true},{status:503})
      : Response.json([]);
    assert.deepEqual(await api.getWorkFeedback(['retry-pole']), []);
    assert.equal(attempts, 2);
    globalThis.fetch=async()=>Response.json({message:'Flow failed',retryable:false},{status:502});
    await assert.rejects(api.getWorkFeedback(ids),/Flow failed/);
    api.invalidateWorkFeedback();
    const requested: string[] = [];
    globalThis.fetch=async(url)=> {
      const id = new URL(String(url), 'https://example.invalid').searchParams.get('poleId')!;
      requested.push(id);
      return id === 'bad' ? Response.json({message:'Flow failed',retryable:false},{status:502}) : Response.json([]);
    };
    await assert.rejects(api.getWorkFeedback(['bad','good1','good2']), /1 pole\(s\).*bad/);
    assert.deepEqual(requested.sort(), ['bad','good1','good2']);
    requested.length = 0;
    await assert.rejects(api.getWorkFeedback(['bad','good1','good2']), /bad/);
    assert.deepEqual(requested, ['bad']);
    api.invalidateWorkFeedback();
    let timeoutCalls = 0;
    globalThis.fetch=async()=> {
      timeoutCalls++;
      return new Response('FUNCTION_INVOCATION_TIMEOUT', {status:504});
    };
    await assert.rejects(api.getWorkFeedback(Array.from({length:168},(_,i)=>'timeout-'+i)), /Background requests have stopped/);
    assert.equal(timeoutCalls,2, 'Timeouts must stop the queue without retrying all 168 poles');
    globalThis.fetch=async()=>Response.json([]);
    assert.deepEqual(await api.getWorkFeedback(['timeout-0']),[], 'Manual refresh can recover');
    api.invalidateWorkFeedback();
    let connectionCalls = 0;
    globalThis.fetch=async(_url,options)=> {
      connectionCalls++;
      assert.ok(options?.signal, 'Feedback requests need a client-side deadline');
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(api.getWorkFeedback(Array.from({length:168},(_,i)=>'offline-'+i)), /Could not connect.*Background requests have stopped/);
    assert.equal(connectionCalls,2, 'Network failures must stop the queue');
    globalThis.fetch=async()=> { throw new DOMException('Timed out', 'TimeoutError'); };
    await assert.rejects(api.getWorkFeedback(['slow']), /Could not connect/);
    globalThis.fetch=async()=>Response.json([]);
    assert.deepEqual(await api.getWorkFeedback(['offline-0']),[]);
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
  source=source.replace(/import \{ StateFilter \}[^;]+;\s*import \{ useStateFilter \}[^;]+;/, 'const StateFilter = () => null; const useStateFilter = (poles) => ({poles, states: [], selection: null, setSelection: () => {}});').replace(/import \{ WorkFormModal \}[^;]+;/,'const WorkFormModal = () => null;')
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

test('save route authenticates, maps the flat schema, and sources locked details from assessment', async () => {
  const {default:saveHandler}=await import('../api/work-form.ts');
  const oldFetch=globalThis.fetch;
  const configured={POWER_AUTOMATE_TENANT_ID:'test-tenant',POWER_AUTOMATE_CLIENT_ID:'test-client',POWER_AUTOMATE_CLIENT_SECRET:'test-secret',POWER_AUTOMATE_SAVE_WORK_FORM_URL:'https://example.invalid/save',POWER_AUTOMATE_GET_POLES_URL:'https://example.invalid/poles'};
  const old=Object.fromEntries(Object.keys(configured).map(key=>[key,process.env[key]]));
  const values={cr1da_inspectionstatus:0,cr1da_fieldtrimmingrequired:1,crf11_trimmingwork:2,cr1da_zone:'tampered street'};
  async function invoke(input:unknown=values){
    const res:any={code:0,body:null,status(c:number){this.code=c;return this;},json(b:unknown){this.body=b;return this;}};
    await saveHandler({method:'PUT',query:{poleId:'P1'},body:{id:'record-id',version:'v2',values:input}},res);return res;
  }
  let savedPayload:any,saveCalls=0,mode='ok';
  try{
    Object.assign(process.env,configured);
    globalThis.fetch=async(url,options)=>{
      assert.ok(options);
      if(String(url).includes('login.microsoftonline.com')){
        assert.equal((options.body as URLSearchParams).get('scope'),'https://service.flow.microsoft.com//.default');
        return Response.json({access_token:'mock-token'});
      }
      if(url===configured.POWER_AUTOMATE_GET_POLES_URL)return Response.json([{cr1da_poleidentifier:'P1',cr1da_feederidentifier:'F1',cr1da_zone:null,cr1da_latitude:0,cr1da_longitude:101.4}]);
      assert.equal(url,configured.POWER_AUTOMATE_SAVE_WORK_FORM_URL);
      assert.equal((options.headers as Record<string,string>).Authorization,'Bearer mock-token');
      saveCalls++;savedPayload=JSON.parse(String(options?.body));
      if(mode==='http-error')return Response.json({error:{code:'TriggerInputSchemaMismatch'}},{status:400});
      if(mode==='rejected')return Response.json({success:false});
      if(mode==='image-ok')return Response.json({success:true,uploadedImageColumns:savedPayload.images.map((image:any)=>image.column)});
      return new Response(null,{status:204});
    };
    assert.equal((await invoke()).code,200);
    assert.equal(savedPayload.poleId,'P1');assert.equal(savedPayload.feederId,'F1');
    assert.equal(savedPayload.streetName,null);assert.equal(savedPayload.latitude,'0');
    assert.equal(savedPayload.inspectionStatus,0);assert.equal(savedPayload.fieldTrimmingRequired,true);
    assert.equal(savedPayload.trimmingWork,2);
    assert.equal((await invoke({...values,cr1da_fieldtrimmingrequired:0})).code,200);
    assert.equal(savedPayload.fieldTrimmingRequired,false);
    mode='http-error';let result=await invoke();assert.equal(result.code,502);assert.match(result.body.message,/HTTP 400/);
    mode='rejected';assert.equal((await invoke()).code,502);
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWuQAAAAASUVORK5CYII=';
    mode='ok';assert.equal((await invoke({...values,cr1da_gambarsemasaditapak:png})).code,502);
    mode='image-ok';assert.equal((await invoke({...values,cr1da_gambarsemasaditapak:png,crf11_gambarselepasditapak:png})).code,200);
    assert.equal(savedPayload.images.length,2);
    assert.equal(savedPayload.images[0].contentBase64,png.split(',')[1]);
    assert.equal(savedPayload.images[0].column,'cr1da_gambarsemasaditapak');
    assert.equal('cr1da_gambarsemasaditapak' in savedPayload.values,false);
    const imageCalls=saveCalls;
    assert.equal((await invoke({...values,cr1da_gambarsemasaditapak:'data:image/png;base64,YWJjZA=='})).code,400);
    assert.equal(saveCalls,imageCalls);
    const before=saveCalls;
    delete process.env.POWER_AUTOMATE_CLIENT_SECRET;
    result=await invoke();assert.equal(result.code,500);assert.match(result.body.message,/tenant authentication/);assert.equal(saveCalls,before);
    assert.equal((await invoke([])).code,400);
  }finally{
    globalThis.fetch=oldFetch;
    for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});


test('unselected and unchanged image fields are omitted, preserving existing Dataverse photos', async () => {
  const {editableWorkFormValues,initialWorkFormValues}=await import('../src/services/workForm.ts');
  const form=normalizeWorkForm({...row,cr1da_gambarsemasaditapak:'existing-image'},'P1');
  const values=initialWorkFormValues(form,{poleId:'P1'} as any);
  let payload=editableWorkFormValues(form,values);
  assert.equal('cr1da_gambarsemasaditapak' in payload,false);
  assert.equal('crf11_gambarselepasditapak' in payload,false);
  values.cr1da_gambarsemasaditapak='data:image/png;base64,newimage';
  payload=editableWorkFormValues(form,values);
  assert.equal(payload.cr1da_gambarsemasaditapak,values.cr1da_gambarsemasaditapak);
});

 test('stored Dataverse image base64 is displayed and absent images stay empty', () => {
  const photo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const form = normalizeWorkForm({...row, cr1da_gambarsemasaditapak: photo}, 'P1');
  assert.equal(form.fields.find(f => f.name === 'cr1da_gambarsemasaditapak')?.value, 'data:image/png;base64,' + photo);
  assert.equal(form.fields.find(f => f.name === 'crf11_gambarselepasditapak')?.value, null);
  const metadata = normalizeWorkForm(form, 'P1');
  assert.deepEqual(metadata, form);
});


test('form and feedback routes return actionable errors on an upstream timeout', async () => {
  const {default:formHandler}=await import('../api/work-form.ts');
  const oldFetch=globalThis.fetch, oldUrl=process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
  try {
    process.env.POWER_AUTOMATE_GET_WORK_FORM_URL='https://example.invalid/read';
    globalThis.fetch=async(_url, options)=> {
      assert.ok(options?.signal, 'Upstream reads must have a timeout');
      throw new DOMException('Timed out', 'TimeoutError');
    };
    for (const route of [handler,formHandler]) {
      const res:any={code:0,body:null,status(c:number){this.code=c;return this;},json(b:unknown){this.body=b;return this;}};
      await route({method:'GET',query:{poleId:'P1'}},res);
      assert.equal(res.code,504);
      assert.equal(res.body.retryable,false);
      assert.match(res.body.message,/flow|GetWorkForm/);
    }
  } finally {
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
    else process.env.POWER_AUTOMATE_GET_WORK_FORM_URL=oldUrl;
  }
});
