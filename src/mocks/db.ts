import { seed, type DemoDB } from './seed'
const key='payment-demo-db-v1'
let memory: DemoDB | undefined
export function getDB(): DemoDB { if (memory) return memory; try { const stored=localStorage.getItem(key); if(stored) return memory=JSON.parse(stored) as DemoDB } catch { /* reset unavailable or malformed storage */ } return memory=seed() }
export function saveDB(): void { try { localStorage.setItem(key,JSON.stringify(getDB())) } catch { /* Demo remains usable in memory. */ } }
export function resetDB(): void { memory=seed(); saveDB() }
export function simulateErrors(): boolean { try { return localStorage.getItem('payment-demo-errors')==='true' } catch { return false } }
export function setSimulateErrors(enabled: boolean): void { try { localStorage.setItem('payment-demo-errors',String(enabled)) } catch { /* storage unavailable */ } }
