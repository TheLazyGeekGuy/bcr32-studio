import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
const r=await build({entryPoints:['src/deployment-storage.ts'],bundle:true,write:false,format:'cjs',platform:'node'}),m={exports:{}}
new Function('module','exports',r.outputFiles[0].text)(m,m.exports)
const {deploymentStorage,deploymentEnvironment,deploymentDatabaseName}=m.exports
assert.equal(deploymentEnvironment('/bcr32-studio/editor/'),'production')
assert.equal(deploymentEnvironment('/bcr32-studio/develop/editor/'),'develop')
assert.equal(deploymentEnvironment('/bcr32-studio/staging/editor/'),'staging')
const values=new Map([['draft','original production draft']]),backend={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
const production=deploymentStorage(backend,'production'),develop=deploymentStorage(backend,'develop'),staging=deploymentStorage(backend,'staging')
assert.equal(develop.getItem('draft'),null,'preview never silently seeds from production')
develop.setItem('draft','dev draft');staging.setItem('draft','candidate')
assert.equal(production.getItem('draft'),'original production draft');assert.equal(develop.getItem('draft'),'dev draft');assert.equal(staging.getItem('draft'),'candidate')
develop.removeItem('draft');assert.equal(staging.getItem('draft'),'candidate');assert.equal(production.getItem('draft'),'original production draft')
assert.equal(deploymentDatabaseName('library','production'),'library');assert.equal(deploymentDatabaseName('library','develop'),'library.develop');assert.equal(deploymentDatabaseName('library','staging'),'library.staging')
const workflow=readFileSync('.github/workflows/pages.yml','utf8')
assert.match(workflow,/ref: production/);assert.match(workflow,/branches: \[develop, staging\]/);assert.match(workflow,/workflow_run/);assert.ok(!/^  push:/m.test(workflow),'main push must not publish production')
assert.match(workflow,/path: public\/develop/);assert.match(workflow,/path: public\/staging/)
assert.match(readFileSync('src/editor-environment.ts','utf8'),/backing \?\? deploymentStorage\(\)/)
assert.match(readFileSync('src/editor-host/StandaloneEditorApp.tsx','utf8'),/deploymentStorage\(\)\.getItem\(hint\)/)
console.log('PASS deployment isolation: production/develop/staging paths, independent draft/instance/presentation storage, distinct database names, retained production data, pinned production source and CI-triggered preview builds')
