import type {SxmParameter} from './types'

/** Required extension: raw wire values need not form a continuous interval. */
export const valueDomainExtension='org.midistudio.value-domain.v1'
export type ValueDomain={step?:number;allowed?:number[]}
export function valueDomain(p:SxmParameter):ValueDomain|undefined{
 return p.extensions?.[valueDomainExtension] as ValueDomain|undefined
}
export function acceptsValue(p:SxmParameter,value:number):boolean{
 const d=valueDomain(p)
 return Number.isSafeInteger(value)&&value>=p.value.minimum&&value<=p.value.maximum&&(!d?.step||(value-p.value.minimum)%d.step===0)&&(!d?.allowed||d.allowed.includes(value))
}
