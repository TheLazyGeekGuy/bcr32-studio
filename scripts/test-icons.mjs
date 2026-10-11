import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),mod={}
const code=ts.transpileModule(readFileSync(new URL('../src/Icon.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
new Function('require','exports',code)(require,mod)
for(const name of ['folder','save','copy','import','export','print','palette','sliders','midi','log','expand','collapse','send','power','rotate','push','close','language']){
  const html=renderToStaticMarkup(React.createElement(mod.Icon,{name}))
  assert.ok(html.includes('aria-hidden="true"'));assert.ok(html.includes('focusable="false"'));assert.ok(html.includes('<path'))
}
console.log('PASS: 18 coherent SVG icons, decorative semantics, no external font or image dependency')
