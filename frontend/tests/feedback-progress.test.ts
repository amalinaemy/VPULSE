import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import handler from '../api/work-feedback.ts';

async function apiModule() {
  const source = await readFile(new URL('../src/services/api.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source.replace('"./workFormResponse"', JSON.stringify(new URL('../src/services/workFormResponse.ts', import.meta.url).href)).replaceAll('import.meta.env', '({})'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
}
const row = {cr1da_feederpolesection:'KG_IJOK_127-2', cr1da_lvvmmodelid:'record-id', '@odata.etag':'W/"4847162"', crf11_trimmingwork:0,
  'crf11_trimmingwork@OData.Community.Display.V1.FormattedValue':'Completed', cr1da_fieldtrimmingrequired:true, cr1da_inspectionstatus:1};

test('successful statuses publish before a slow failure; retry keeps loaded records cached', async () => {
  const api = await apiModule(); api.invalidateWorkFeedback();
  const original = globalThis.fetch;
  const progress: string[] = []; let release: (response: Response) => void = () => {};
  try {
    globalThis.fetch = async url => String(url).includes('poleId=good') ? Response.json([{poleId:'good',trimmingWork:'Completed'}]) : new Promise<Response>(resolve => {release=resolve;});
    const loading = api.getWorkFeedback(['good','slow'], undefined, (item: any) => progress.push(item.poleId));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(progress,['good']);
    release(Response.json({message:'Flow timed out'}, {status:504}));
    await assert.rejects(loading,/Flow timed out/);
    const requests: string[]=[];
    globalThis.fetch=async url=>{requests.push(String(url));return Response.json([]);};
    const result=await api.getWorkFeedback(['good','slow']);
    assert.equal(requests.length,1);assert.match(requests[0],/slow/);
    assert.equal(result.find((item:any)=>item.poleId==='good').trimmingWork,'Completed');
    assert.equal(result.find((item:any)=>item.poleId==='slow').trimmingWork,null);
  } finally {globalThis.fetch=original;}
});

test('raw flow record opens as fields and a saved status survives an older background response', async () => {
  const api=await apiModule();api.invalidateWorkFeedback();const original=globalThis.fetch;
  const updates:any[]=[];const unsubscribe=api.subscribeWorkFeedback((item:any)=>updates.push(item));
  try {
    globalThis.fetch=async()=>Response.json(row);
    const form=await api.getWorkForm(row.cr1da_feederpolesection);
    assert.equal(form.id,'record-id');assert.equal(form.version,'W/"4847162"');
    assert.equal(form.fields.find((f:any)=>f.name==='crf11_trimmingwork').value,0);
    assert.equal(updates.at(-1).trimmingWork,'Completed');
    api.invalidateWorkFeedback(row.cr1da_feederpolesection);
    let release:(response:Response)=>void=()=>{};
    globalThis.fetch=async(url,options)=>options?.method==='PUT'?Response.json({ok:true}):new Promise<Response>(resolve=>{release=resolve;});
    const loading=api.getWorkFeedback([row.cr1da_feederpolesection]);
    await api.saveWorkForm(row.cr1da_feederpolesection,form.id,form.version,{crf11_trimmingwork:1});
    assert.equal(updates.at(-1).trimmingWork,'In Progress');
    release(Response.json([{poleId:row.cr1da_feederpolesection,trimmingWork:'Completed'}]));
    assert.equal((await loading)[0].trimmingWork,'In Progress');
  } finally {unsubscribe();globalThis.fetch=original;}
});

test('flow timeouts return 504 without encouraging retries', async () => {
  const original=globalThis.fetch;const old=process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
  try {
    process.env.POWER_AUTOMATE_GET_WORK_FORM_URL='https://example.invalid/flow';
    globalThis.fetch=async()=>{throw new DOMException('Timed out','TimeoutError');};
    const res:any={code:0,body:null,status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;}};
    await handler({method:'GET',query:{poleId:'test'}},res);
    assert.equal(res.code,504);assert.equal(res.body.retryable,false);
  } finally {globalThis.fetch=original;if(old===undefined)delete process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;else process.env.POWER_AUTOMATE_GET_WORK_FORM_URL=old;}
});
