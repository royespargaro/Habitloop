import { describe, expect, it } from 'vitest';
import { getStreak, mk } from '../utils/habitUtils';
describe('habitUtils', () => {
 it('calculates a streak using the original month-first schema',()=>{const now=new Date(2026,9,25);const checks={[mk(2026,9)]:{h1:{'22':'done','23':'done','24':'done','25':'done'}}};expect(getStreak('h1',checks,now)).toBe(4);});
 it('keeps the previous streak when today is not completed',()=>{const now=new Date(2026,9,25);const checks={[mk(2026,9)]:{h1:{'22':'done','23':'done','24':'done'}}};expect(getStreak('h1',checks,now)).toBe(3);});
 it('does not count skipped days as completed or break the streak',()=>{const now=new Date(2026,9,25);const checks={[mk(2026,9)]:{h1:{'22':'done','23':'skipped','24':'done','25':'done'}}};expect(getStreak('h1',checks,now)).toBe(3);});
});
