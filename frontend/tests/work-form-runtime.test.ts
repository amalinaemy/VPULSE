import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('compiled work-form function starts without source TypeScript imports', async () => {
 const source=await readFile(new URL('../api/work-form.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
 const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const res:any={code:0,body:null,status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;}};
 await handler({method:'GET',query:{}},res);
 assert.equal(res.code,400);assert.equal(res.body.message,'Pole ID is required.');
});
