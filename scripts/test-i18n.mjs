import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const mod = {}, nativeRequire = createRequire(import.meta.url)
const status = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-status.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(status)
const xtouch = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-xtouch.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(xtouch)
const translator = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-translator.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(translator)
const offline = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-offline.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(offline)
const library = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-library.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(library)
const bcr32 = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/i18n-bcr32.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(bcr32)
const icons = {}
new Function('require', 'exports', ts.transpileModule(readFileSync(new URL('../src/Icon.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(nativeRequire, icons)
const require = name => name === './i18n-bcr32' ? bcr32 : name === './i18n-status' ? status : name === './i18n-xtouch' ? xtouch : name === './i18n-translator' ? translator : name === './i18n-offline' ? offline : name === './i18n-library' ? library : name === './Icon' ? icons : nativeRequire(name)
new Function('require', 'exports', ts.transpileModule(readFileSync(new URL('../src/i18n.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(require, mod)
assert.equal(mod.languages.length, 8)
for (const row of Object.values(mod.catalog)) for (const { id } of mod.languages) assert.ok(typeof row[id] === 'string' && row[id].length, id)
assert.equal(mod.translate('Channel', 'fr'), 'Canal')
assert.equal(mod.translate('Channel', 'en'), 'Channel', 'English is the source: identity')
assert.equal(mod.translate('Encoder 8', 'ja'), 'エンコーダー 8')
assert.equal(mod.translate('Encoder 8', 'fr'), 'Encodeur 8')
assert.equal(mod.parseLanguage('cn'), 'en')
assert.equal(mod.parseLanguage('zh'), 'zh')
assert.equal(mod.detectLanguage(['pt-BR', 'es-ES', 'en-US']), 'es')
assert.equal(mod.detectLanguage(['de-DE', 'fr-FR']), 'de')
assert.equal(mod.detectLanguage(['ja-JP']), 'ja')
assert.equal(mod.detectLanguage(['zh-CN']), 'zh')
assert.equal(mod.detectLanguage(['IT_it']), 'it')
assert.equal(mod.detectLanguage(['xx']), 'en', 'Unsupported browser language falls back to English')
assert.equal(mod.detectLanguage(['fr-CA']), 'fr')
assert.equal(mod.loadLanguageChoice(), 'auto')
const picker = renderToStaticMarkup(React.createElement(mod.LanguagePicker))
assert.ok(picker.includes('class="language-icon-picker"'))
assert.equal((picker.match(/<option /g) ?? []).length, 9)
assert.ok(picker.includes('<select aria-label="Language"'))
for (const name of ['English', 'Français', 'Italiano', 'Deutsch', '日本語', 'Español', 'Русский', '简体中文']) assert.ok(picker.includes(`>${name}</option>`), name)
const message = 'CC sending enabled: UI gestures send values to BCR32, not assignments.'
for (const { id } of mod.languages.filter(l => l.id !== 'en')) assert.notEqual(mod.translate(message, id), message)
assert.match(mod.translate(message, 'es'), /^Envío CC activado/)
assert.equal(mod.translate(message, 'fr'), 'Émission CC activée : les gestes IHM envoient des valeurs au BCR32, pas des assignations.')
assert.equal(mod.translate('Preset “Channel” saved in this browser. Visual labels only.', 'fr'), 'Preset « Channel » sauvegardé dans ce navigateur. Étiquettes visuelles uniquement.', '{name} slot copied verbatim')
assert.equal(mod.translate('Import rejected: Duplicate parameter.', 'es'), 'Importación rechazada: Parámetro duplicado.')
assert.equal(mod.translate('Import rejected: Duplicate parameter.', 'fr'), 'Import refusé : Paramètre en doublon.', '{detail} slot translated recursively')
assert.equal(mod.translate('Import rejected: Invalid preset', 'fr'), 'Import refusé : Preset invalide')
assert.equal(mod.translate('Profile imported: my profile.json', 'fr'), 'Profil importé : my profile.json', '{file} slot copied verbatim')
assert.equal(mod.translate('3 preset(s) imported into the library, without loading or MIDI sending.', 'fr'), '3 preset(s) importé(s) dans la bibliothèque, sans chargement ni envoi MIDI.', '{count} slot')
assert.equal(mod.translate('Theme Amethyst', 'fr'), 'Thème Améthyste')
// Deliberately source-level: every setNotice literal in App.tsx must be a catalog key (catalog completeness, not behaviour).
const app = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function check(n) {
  if (ts.isCallExpression(n) && n.expression.getText(app) === 'setNotice' && ts.isStringLiteral(n.arguments[0])) assert.ok(mod.catalog[n.arguments[0].text], 'Missing notice: ' + n.arguments[0].text)
  ts.forEachChild(n, check)
}
check(app)
const input = React.createElement('input', { value: 'Channel', placeholder: 'Channel', readOnly: true })
const html = renderToStaticMarkup(mod.translatedTree(input, 'fr'))
assert.ok(html.includes('value="Channel"')); assert.ok(html.includes('placeholder="Canal"'))
const label = React.createElement('span', { 'data-i18n-skip': true }, 'Channel')
assert.ok(renderToStaticMarkup(mod.translatedTree(label, 'fr')).endsWith('Channel</span>'))
const fragment = React.createElement(React.Fragment, null, React.createElement('button', {key:'feedback'}, 'Enable hardware feedback'), React.createElement('span', {'data-i18n-skip':true}, 'Channel'))
const fragmentHtml=renderToStaticMarkup(mod.translatedTree(fragment,'fr'))
assert.ok(fragmentHtml.includes('Activer le retour matériel'));assert.ok(fragmentHtml.includes('>Channel</span>'))
// Keys must not depend on the language: Children.map would re-key children (.0, .1…) and React would remount
// the whole subtree on every en <-> other switch, losing field drafts, focus and open <details>.
const keyed = React.createElement('main', null, React.createElement('section', { key: 'a' }, 'Channel'), React.createElement('section', null, [React.createElement('i', { key: 's' }, 'Channel'), React.createElement('b', { key: 'x' }, 'Channel')]), 'Channel')
const keysOf = node => (Array.isArray(node.props.children) ? node.props.children : [node.props.children]).map(child => React.isValidElement(child) ? child.key : typeof child)
assert.equal(mod.translatedTree(keyed, 'en'), keyed, 'English: same tree object')
for (const language of ['fr', 'de']) {
  const tree = mod.translatedTree(keyed, language)
  assert.deepEqual(keysOf(tree), keysOf(keyed), 'Top-level child keys preserved in ' + language)
  assert.deepEqual(keysOf(tree.props.children[1]), keysOf(keyed.props.children[1]), 'Nested array keys preserved in ' + language)
  assert.ok(renderToStaticMarkup(tree).includes('>Canal<') || renderToStaticMarkup(tree).includes('>Kanal<'), 'Still translated')
}
assert.ok(!Object.keys(mod.catalog).some(key => key.includes('0.56.0')), 'No firmware literal in the catalog')
console.log('PASS: eight complete core catalogs, English source with French translated, Japanese headings, locale validation and English fallback, slots, labels, values and keys preserved')

// Catalog completeness: every source row has exactly 8 non-empty columns and keys are unique.
const rowLines = ['../src/i18n.tsx', '../src/i18n-status.ts', '../src/i18n-xtouch.ts', '../src/i18n-translator.ts', '../src/i18n-offline.ts','../src/i18n-library.ts'].flatMap(file => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/^  '((?:[^'\\]|\\.)*)',?$/gm)].map(m => m[1])).concat(bcr32.bcr32Rows)
assert.ok(rowLines.length > 100, 'catalog rows parsed from source')
for (const row of rowLines) { const parts = row.split('|'); assert.equal(parts.length, 8, 'Row must have 8 columns: ' + row.slice(0, 60)); parts.forEach((part, i) => assert.ok(part.trim().length, `Empty column ${i} in: ${row.slice(0, 60)}`)) }
assert.equal(new Set(rowLines.map(row => row.split('|')[0])).size, rowLines.length, 'Duplicate catalog key')
assert.equal(Object.keys(mod.catalog).length, rowLines.length)
assert.equal(mod.translate('Push 3 · Accent', 'de'), 'Druck 3 · Accent')
assert.equal(mod.translate('Rename Encodeur 3', 'fr'), 'Renommer Encodeur 3')
assert.equal(mod.translate('FOOTSW 2 function', 'fr'), 'Fonction FOOTSW 2')
assert.equal(mod.translate('STORE shown: no hardware command sent.', 'fr'), 'STORE représenté : aucune commande matérielle envoyée.')
// Components translatedTree never reaches must translate their own literals through the shared context.
const cache = new Map([['./i18n', mod], ['./i18n-status', status], ['./Icon', icons]])
function load(name) {
  if (!name.startsWith('./')) return nativeRequire(name)
  if (cache.has(name)) return cache.get(name)
  const base = new URL(`../src/${name.slice(2)}`, import.meta.url).pathname, file = existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`
  if (name.endsWith('.json')) return JSON.parse(readFileSync(base, 'utf8'))
  const exports = {}; cache.set(name, exports)
  new Function('require', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(load, exports)
  return exports
}
assert.match(renderToStaticMarkup(React.createElement(load('./App').default)), /Retry MIDI \+ SysEx<\/button><[a-z]+ class="language-icon-picker"/, 'Language picker rendered next to the MIDI retry button')
const { createProfile } = load('./profile'), { emptyLabels } = load('./presets')
const profile = createProfile(), selection = { kind: 'encoders', id: 1 }, labels = emptyLabels()
labels.pushes[0] = 'Accent'
const inLanguage = (language, type, props) => renderToStaticMarkup(React.createElement(mod.I18nContext.Provider, { value: { language, choice: language, setChoice() {} } }, React.createElement(type, props)))
const components = {
  FrontPanel: [load('./FrontPanel').FrontPanel, { profile, selection, select() {}, action() {}, customLabels: labels }],
  OledDisplay: [load('./OledDisplay').OledDisplay, { control: selection, config: profile.encoders[0], value: null, source: 'local', style: {}, inspect() {}, setValue() {} }],
  ActivityLeds: [load('./ActivityLeds').ActivityLeds, {}],
  StudioConfig: [load('./StudioConfig').StudioConfig, { profile, update() {}, select() {}, brightness: null, draft: 5, setDraft() {}, brightnessEnabled: false, brightnessStatus: 'Waiting for read-back…' }],
  ControlSearch: [load('./ControlSearch').ControlSearch, { profile, labels, selection, select() {} }],
}
// No French literal may reach the English (source) render; the French render must come entirely from the catalog.
const frenchLiterals = ['Renommer', 'Façade', 'Étiquette', 'Simple clic', 'Double-clic ou', 'présence matérielle', 'commande matérielle', 'profil local', 'assigné', 'Écran OLED', 'Inspecter', 'Saisir', ' canal ', ' valeur ', 'inconnue', 'Voyants', 'éteint', 'activité', 'indication logicielle', 'désactivé', 'Configuration locale', 'Commandes et pédales', 'Fonction FOOTSW', 'Luminosité', 'Relecture', 'Permission SysEx', 'Routage', 'Réglages', 'Mode de', 'Filtré', 'Contrôle', 'Recherche', 'Encodeur', 'Bouton ', 'INCONNU', 'ESTIME']
const expectedEnglish = {
  FrontPanel: ['Interactive BCR32 front panel', 'aria-label="Encoder 1 rotation"', 'aria-label="Encoder 1 push"', 'aria-label="Button 5 PITCH"', 'Encoder label 1 ', 'Push label 1 Accent', 'hardware presence unconfirmed', 'hardware command not enabled', 'local profile', 'SELECT rotation and push', 'Click: select. Double-click or F2: rename.'],
  OledDisplay: ['OLED screen: ENC 1', 'channel 1, value unknown, unknown', 'Inspect ENC 1 from the OLED screen', 'aria-label="OLED value ENC 1"', 'Arrows: adjust.', 'data-source="UNKNOWN"'],
  ActivityLeds: ['Editor indicators, not a read-out of the hardware LEDs', 'MIDI IN : off', 'disabled, handling not implemented', 'USB · activity local UI gesture · software indication'],
  StudioConfig: ['Local configuration · hardware assignment writes are not validated.', 'Controls &amp; footswitches', 'FOOTSW 1 function', 'CTRL · programmable', 'LED brightness · hardware', 'Read-back: N/A / 15', 'aria-label="LED brightness"', 'Waiting for read-back…', 'Output routing', 'Startup mode', 'Operation mode', 'Filtered'],
  ControlSearch: ['>Control<', 'aria-label="Control search"', 'placeholder="Search name, number, CC…"', 'value="Encoder 1 · '],
}
const expectedFrench = {
  FrontPanel: ['Façade interactive du BCR32', 'aria-label="Encodeur 1 rotation"', 'aria-label="Bouton 5 PITCH"', 'présence matérielle à confirmer'],
  OledDisplay: ['Écran OLED : ENC 1', 'canal 1, valeur inconnue, inconnue', 'Inspecter ENC 1 depuis l’écran OLED'],
  ActivityLeds: ['Voyants de l’éditeur', 'MIDI IN : éteint'],
  StudioConfig: ['Configuration locale · les écritures', 'Fonction FOOTSW 1', 'Attente de la relecture…'],
  ControlSearch: ['placeholder="Rechercher nom, numéro, CC…"', 'value="Encodeur 1 · '],
}
for (const [name, [type, props]] of Object.entries(components)) {
  const english = inLanguage('en', type, props)
  for (const literal of frenchLiterals) assert.ok(!english.includes(literal), `${name} still shows French in English: ${literal}`)
  for (const text of expectedEnglish[name]) assert.ok(english.includes(text), `${name} missing English text: ${text}`)
  const french = inLanguage('fr', type, props)
  for (const text of expectedFrench[name]) assert.ok(french.includes(text), `${name} missing French text: ${text}`)
  assert.ok(renderToStaticMarkup(React.createElement(type, props)) === english, `${name}: default context must render English`)
}
assert.ok(inLanguage('ja', ...components.ActivityLeds).includes('MIDI IN : 消灯'))
// Silkscreen and technical values stay untranslated in every language (data-source is the dot-matrix origin code, not spoken).
for (const text of ['SELECT', 'STORE', 'ZQR / CTRL', 'data-source="UNKNOWN"']) assert.ok(inLanguage('de', ...components.FrontPanel).includes(text), text)
assert.ok(inLanguage('de', ...components.OledDisplay).includes('Wert unbekannt, unbekannt'), 'Spoken origin translated, not the dot-matrix UNKNOWN')
// Manual terms kept as technical names in StudioConfig: MIDI Through (BCR-32 manual), N/A read-back placeholder.
for (const text of ['<summary>MIDI Through</summary>', 'N/A / 15']) assert.ok(inLanguage('de', ...components.StudioConfig).includes(text), text)
// A send failure on the brightness path must still reach the UI as a catalog key, translated like any other status.
const { createBrightnessTransport } = load('./led-brightness')
let published
createBrightnessTransport(() => { throw Error('BCR32 output disconnected') }, state => { published = state }).read()
assert.ok(mod.catalog[published.status], 'Brightness send failure publishes a catalog key: ' + published.status)
const failedStatus = inLanguage('fr', components.StudioConfig[0], { ...components.StudioConfig[1], brightnessStatus: published.status })
assert.ok(failedStatus.includes('role="status">Sortie BCR32 déconnectée<') && !failedStatus.includes('Error:'), 'Brightness failure translated in French')
// Log descriptions (web-midi describeMessage) are catalog keys or patterns; the hex dump stays verbatim.
const { describeMessage } = load('./web-midi')
for (const frame of [[0xf8], [0xb0, 0x10, 0x40], [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0x01, 0x00, 0x00, 0x00, 0x38, 0x00, 0xf7]]) {
  const description = describeMessage(frame)
  for (const id of ['fr', 'de', 'ja', 'es']) assert.notEqual(mod.translate(description, id), description, `${description} untranslated in ${id}`)
}
assert.equal(describeMessage([0xb0, 0x10, 0x40]), 'CC channel 1 · 16 → 64')
assert.equal(mod.translate(describeMessage([0xb0, 0x10, 0x40]), 'fr'), 'CC canal 1 · 16 → 64')
assert.equal(mod.translate('value sent', 'fr'), 'valeur envoyée'); assert.equal(mod.translate('B0 10 40', 'fr'), 'B0 10 40', 'Hex dump untouched')
assert.ok(inLanguage('de', ...components.ControlSearch).includes('value="Encoder 1 · '))
// Rendered App: English by default (source language, no provider), French entirely from the catalog.
const AppComponent = load("./App").default
const appEnglish = renderToStaticMarkup(React.createElement(AppComponent))
for (const text of ['Retry MIDI + SysEx', 'Send CC to BCR32', 'MIDI reception available after connection; CC sending disabled. Hardware configuration locked.', 'aria-label="Editor tools"', 'SELECTED ENCODER']) assert.ok(appEnglish.includes(text), 'App default render in English: ' + text)
for (const literal of ['Réessayer', 'Envoyer les CC', 'Réception MIDI', 'Outils de l’éditeur', 'ENCODEUR SÉLECTIONNÉ', 'Thème ']) assert.ok(!appEnglish.includes(literal), 'No French in the default App render: ' + literal)
const appFrench = inLanguage("fr", AppComponent, {})
for (const text of ['Réessayer MIDI + SysEx', 'Envoyer les CC au BCR32', 'Réception MIDI disponible après connexion ; émission CC désactivée. Configuration matérielle verrouillée.', 'aria-label="Outils de l’éditeur"', 'ENCODEUR SÉLECTIONNÉ', 'aria-label="Thème Améthyste"', 'aria-label="Édition encoders 1"']) assert.ok(appFrench.includes(text), 'App French render: ' + text)
console.log('PASS: catalog rows complete and unique; App, FrontPanel, OledDisplay, ActivityLeds, StudioConfig and ControlSearch render English by default with no French literal, and French from the catalog')
