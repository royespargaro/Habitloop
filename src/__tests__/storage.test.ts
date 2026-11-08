import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultData, isValidAppData, loadData, migrateLegacyData, saveData } from '../services/appStore';

describe('appStore', () => {
  beforeEach(() => { const values = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem: vi.fn((k:string)=>values.get(k)??null), setItem: vi.fn((k:string,v:string)=>values.set(k,v)), clear: vi.fn(()=>values.clear()) }); });
  it('creates a complete version 2 data structure', () => { const data=createDefaultData(); expect(data.schemaVersion).toBe(2); expect(data.habits.length).toBeGreaterThan(0); expect(data.tasks).toEqual([]); expect(isValidAppData(data)).toBe(true); });
  it('round-trips current data through local storage', () => { const data=createDefaultData(); saveData(data); expect(loadData()).toEqual(data); });
  it('migrates original month-first HabitMatrix arrays', () => { const data=migrateLegacyData({habits:[{id:'h1',name:'Read'}],checks:{'2026-10':{h1:[22,23,25]}}}); expect(data.habits?.[0].id).toBe('h1'); expect(data.habitLogs?.map(x=>x.date).sort()).toEqual(['2026-10-22','2026-10-23','2026-10-25']); });
  it('migrates object statuses and ignores impossible dates', () => { const data=migrateLegacyData({habits:[{id:'h1',name:'Read'}],checks:{'2026-02':{h1:{'28':'done','29':'done','30':'done','27':'skipped'}}}}); expect(data.habitLogs?.map(x=>[x.date,x.status]).sort()).toEqual([['2026-02-27','skipped'],['2026-02-28','done']]); });
  it('supports the inverse legacy shape from the early migration attempt', () => { const data=migrateLegacyData({habits:[{id:'h1',name:'Read'}],checks:{h1:{'2026-10':[4,5]}}}); expect(data.habitLogs?.map(x=>x.date).sort()).toEqual(['2026-10-04','2026-10-05']); });
  it('persists migration so generated IDs remain stable after reload', () => { localStorage.setItem('habitmatrix.v1',JSON.stringify({habits:[{id:'h1',name:'Read'}],checks:{'2026-10':{h1:[22]}}})); const data=loadData(); expect(JSON.parse(localStorage.getItem('habitloop.execution.v2')??'null')).toEqual(data); });
});
