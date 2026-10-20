import {readFileSync,existsSync,statSync} from 'node:fs'
import {resolve,relative,extname,sep} from 'node:path'
/** Development only: expose the last built static portal without importing Vue into the app. */
export function docsDevPlugin(){return{name:'midi-studio-documentation-dev',configureServer(server){
 const root=resolve('dist/docs')
 server.middlewares.use((req,res,next)=>{
  if(!/^\/docs(?:\/|\?|$)/.test(req.url??''))return next()
  if(!['GET','HEAD'].includes(req.method??'')){res.statusCode=405;res.end();return}
  // Instrument guides may import their own illustrations into an editor. Let
  // Vite resolve those source assets (including ?import), not the built portal.
  if(/^\/docs\/instruments\/[^?#]+\.(?:png|webp|svg|jpe?g)(?:\?|$)/i.test(req.url??''))return next()
  let path
  try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(5))}catch{res.statusCode=400;res.end('Invalid documentation path');return}
  const rel=relative(root,path)
  if(rel==='..'||rel.startsWith('..'+sep)){res.statusCode=403;res.end();return}
  if(existsSync(path)&&statSync(path).isDirectory())path=resolve(path,'index.html')
  if(!existsSync(path)||!statSync(path).isFile()){res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Documentation unavailable. Run npm run docs:build.');return}
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(path)]??'application/octet-stream'
  res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?undefined:readFileSync(path))
 })
}}}
