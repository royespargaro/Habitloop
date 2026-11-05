
import { describe, it, expect } from 'vitest';
import { getStreak, mk } from '../utils/habitUtils';

describe('habitUtils', () => {
    it('calculates streak correctly', () => {
        const now = new Date(2026, 9, 25); // Oct 25, 2026
        const checks = {
            [mk(2026, 9)]: { 'h1': [22, 23, 24, 25] }
        };
        expect(getStreak('h1', checks, now)).toBe(4);
    });

    it('returns 0 streak if today is missed', () => {
        const now = new Date(2026, 9, 25);
        const checks = {
            [mk(2026, 9)]: { 'h1': [22, 23, 24] }
        };
        expect(getStreak('h1', checks, now)).toBe(0);
    });
});
