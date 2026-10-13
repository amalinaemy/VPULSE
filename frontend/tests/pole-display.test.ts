import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function loadSource(path: string, jsx = false) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  source = source.replaceAll('import.meta.env', '({})');
  if (jsx) source = `import * as React from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)};\n` + source;
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React,
  }}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
}

test('numeric Dataverse choices become labels and the home page renders after data loads', async () => {
  const api = await loadSource('../src/services/api.ts');
  const { HomePage } = await loadSource('../src/pages/HomePage.tsx', true);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json([{
      cr1da_poleidentifier: 'TEST-1', cr1da_risknumericvalue: 90,
      cr1da_finalairiskcategory: 100000003,
      'cr1da_finalairiskcategory@OData.Community.Display.V1.FormattedValue': 'CRITICAL',
      cr1da_landcovertype: 100000001,
      'cr1da_landcovertype@OData.Community.Display.V1.FormattedValue': 'Trees',
      crf11_state: 'MELAKA', cr1da_relativevegetationindex: 0.7,
      cr1da_normalizeddifferencevegetationind: 0.5,
    }, { cr1da_finalairiskcategory: 100000003, cr1da_landcovertype: 100000001 }]);
    const poles = await api.getPoles();
    assert.equal(poles[0].finalAiRiskCategory, 'CRITICAL');
    assert.equal(poles[0].landCoverType, 'Trees');
    assert.equal(poles[0].state, 'MELAKA');
    assert.equal(poles[0].rvi, 0.7);
    assert.equal(poles[1].finalAiRiskCategory, null);
    assert.equal(poles[1].landCoverType, null);
    const html = renderToStaticMarkup(createElement(HomePage, {
      poles, isLoading: false, error: null, onNavigate() {},
    }));
    assert.match(html, /Prioritise Pole TEST-1/);
    assert.match(html, /Critical/);
  } finally { globalThis.fetch = originalFetch; }
});
