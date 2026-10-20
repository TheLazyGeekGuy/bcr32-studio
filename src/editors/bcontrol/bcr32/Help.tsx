import {useState} from 'react'
import {translate,useLanguage} from './i18n'
const topics=[
 ['Controller synchronization','Read each preset once per connection. T1–T4 then restore cached assignments and values, including UI edits. Unobserved hardware changes are ignored. Read controller now refreshes this preset. Cached edits are not automatically resent or stored.'],
 ['Preset management','Read hardware presets, save to an explicit destination, or export a file. Browser copies and hardware memory are separate.'],
 ['Assignment sending','CC/NRPN encoder settings and Type OFF for buttons, pushes and encoders. Each change is read back. Preset saving stays manual.'],
 ['Bank Off','Bank Off disables the Program Change bank selection, not the Program Change assignment.'],
 ['MIDI monitor','The shared monitor shows input and output messages, with filters and local assignment from a selected message.'],
 ['Undo and redo','Undo and redo restore local edits and disable sending. They do not undo a hardware write or STORE.'],
 ['Rearrange controls','Drag encoder labels or programmable buttons to swap, insert, or copy assignments locally. T1–T4 remain preset shortcuts.'],
 ['Presentation','Screen scale, zoom, themes and floating screens are interface preferences. They do not change hardware LEDs.'],
 ['Unsupported assignments','Controller assignment cannot be represented. The fields below remain the local draft; inspect the raw replies.'],
] as const
export function Bcr32Help(){const language=useLanguage(),t=(s:string)=>translate(s,language),[query,setQuery]=useState('');const rows=topics.filter(row=>row.map(t).join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));return <section className="help-panel" aria-label={t('Help')}><h2>{t('BCR32 user guide')}</h2><input type="search" aria-label={t('Search the help…')} value={query} onChange={e=>setQuery(e.target.value)}/><dl>{rows.map(([title,body])=><div key={title}><dt>{t(title)}</dt><dd>{t(body)}</dd></div>)}</dl></section>}
