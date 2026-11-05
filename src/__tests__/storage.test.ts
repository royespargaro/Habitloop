
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { load, save, defaults } from '../services/storage';

describe('storage', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn()
        });
    });
    it('loads defaults if empty', () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);
        expect(load()).toEqual(defaults());
    });
    it('saves and loads data', () => {
        const data = { habits: [{ id: 'h1', name: 'Test Habit' }], checks: {}, nid: 1 };
        vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(data));
        expect(load()).toEqual(data);
    });
});
