/** GitHub Pages subpaths share an origin. Preview data must never reuse production drafts. */
export function deploymentEnvironment(pathname=typeof location==='undefined'?'':location.pathname):'production'|'develop'|'staging'{
  return /(?:^|\/)develop(?:\/|$)/.test(pathname)?'develop':/(?:^|\/)staging(?:\/|$)/.test(pathname)?'staging':'production'
}
export function deploymentStorage(backing:Pick<Storage,'getItem'|'setItem'|'removeItem'>=window.localStorage,environment=deploymentEnvironment()){
  const prefix=environment==='production'?'':`midi-studio.environment.${environment}.`
  return {getItem:(key:string)=>backing.getItem(prefix+key),setItem:(key:string,value:string)=>backing.setItem(prefix+key,value),removeItem:(key:string)=>backing.removeItem(prefix+key)}
}
export const deploymentDatabaseName=(name:string,environment=deploymentEnvironment())=>environment==='production'?name:`${name}.${environment}`
