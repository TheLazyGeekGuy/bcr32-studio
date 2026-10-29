import {execFileSync} from 'node:child_process'
import type {Plugin} from 'vite'
import {readFileSync} from 'node:fs'
export function deploymentPlugin():Plugin{
  const environment=process.env.MIDI_STUDIO_DEPLOYMENT
  if(environment&&!['develop','staging'].includes(environment))throw Error('Only nonproduction build environments are accepted')
  const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
  const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version
  return {name:'studio-deployment',apply:'build',transformIndexHtml:environment?html=>html.replace('</head>','<link rel="stylesheet" href="'+(html.includes('id="root"')?'../':'./')+'deployment-environment.css"></head>').replace('<body>',`<body><aside class="deployment-environment" aria-label="Deployment environment">${environment.toUpperCase()} · ${version}</aside>`):undefined,
    generateBundle(){
      this.emitFile({type:'asset',fileName:'deployment.json',source:JSON.stringify({environment:environment??'production',sourceRevision,version})+'\n'})
      if(environment)this.emitFile({type:'asset',fileName:'deployment-environment.css',source:'.deployment-environment{position:fixed;bottom:0;left:0;z-index:2147483647;background:#f3ae46;color:#171717;font:700 12px system-ui;padding:3px 12px;pointer-events:none;letter-spacing:.08em} '})
    }}
}
