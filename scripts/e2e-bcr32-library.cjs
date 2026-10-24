// End-to-end check of Presets › On this computer in a real browser: save three presets, drag the last one to the top,
// reload (order kept), export the library, re-import the exported file (appended in the same order), move with ↓.
// No MIDI access is granted, so nothing can be sent. Usage: PLAYWRIGHT_CORE=<playwright-core> node scripts/e2e-bcr32-library.cjs <url>
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const url=process.argv[2];if(!url)throw Error('usage: e2e-bcr32-library.cjs <url>')
const fail=m=>{throw Error('FAIL '+m)}
;(async()=>{const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bcr32-library-'))
 const ctx=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:900},acceptDownloads:true,serviceWorkers:'block'})
 try{
  await ctx.addInitScript(()=>{try{localStorage.setItem('bcr32-studio.language.v1','en')}catch{};Object.defineProperty(navigator,'requestMIDIAccess',{value:undefined,configurable:true})})
  const pg=await ctx.newPage();await pg.goto(url,{waitUntil:'networkidle'});await pg.waitForSelector('nav.tool-tabs')
  const open=async()=>{await pg.locator('nav.tool-tabs button',{hasText:'Presets'}).click();await pg.getByRole('button',{name:'On this computer',exact:true}).click()}
  const names=async()=>pg.locator('.library-list .library-name span').allInnerTexts()
  await open()
  for(const [i,name] of ['Live','Studio','Drums'].entries()){
   await pg.locator('.browser-presets').getByRole('button',{name:'Save',exact:true}).click()
   await pg.locator('.preset-save-sheet input').fill(name)
   await pg.locator('.preset-save-sheet').getByRole('button',{name:i?'Save as new':'Create preset'}).click()
  }
  if(JSON.stringify(await names())!=='["Live","Studio","Drums"]')fail('three saved presets expected, got '+JSON.stringify(await names()))
  await pg.locator('.library-list li').nth(2).dragTo(pg.locator('.library-list li').nth(0))
  if(JSON.stringify(await names())!=='["Drums","Live","Studio"]')fail('drag to top did not reorder: '+JSON.stringify(await names()))
  await pg.reload({waitUntil:'networkidle'});await pg.waitForSelector('nav.tool-tabs');await open()
  if(JSON.stringify(await names())!=='["Drums","Live","Studio"]')fail('order not kept after reload: '+JSON.stringify(await names()))
  const [download]=await Promise.all([pg.waitForEvent('download'),pg.locator('.browser-presets').getByRole('button',{name:'Export',exact:true}).click()])
  const saved=path.join(profile,'library.json');await download.saveAs(saved)
  const exported=JSON.parse(fs.readFileSync(saved,'utf8'))
  if(JSON.stringify(exported.presets.map(p=>p.name))!=='["Drums","Live","Studio"]')fail('export lost the order')
  await pg.locator('.browser-presets input[type=file]').setInputFiles(saved)
  await pg.waitForFunction(()=>document.querySelectorAll('.library-list li').length===6,null,{timeout:5000}).catch(()=>{}) // the file is read asynchronously
  const after=await names()
  if(JSON.stringify(after)!=='["Drums","Live","Studio","Drums","Live","Studio"]')fail('re-import should append the same order: '+JSON.stringify(after))
  await pg.locator('.library-list li').nth(0).getByRole('button',{name:'Move down'}).click()
  if(JSON.stringify((await names()).slice(0,2))!=='["Live","Drums"]')fail('Move down did not swap the first two rows')
  console.log('PASS library e2e: 3 presets saved, drag to top kept after reload, export kept the order, re-import appended it, Move down works')
 }finally{await ctx.close();fs.rmSync(profile,{recursive:true,force:true})}
})().catch(e=>{console.error(String(e));process.exit(1)})
