
const KEY = 'habitmatrix.v1';
const DEF = ['Wake up at 06:00', 'Meditation', 'Gym', 'Cold shower', 'Deep work', 'Read 10 pages', 'Learn a skill', 'Sleep before 23:00'];

export const defaults = () => ({
    habits: DEF.map((n, i) => ({ id: 'h' + i, name: n })),
    checks: {},
    nid: DEF.length
});

export const load = () => {
    try {
        const stored = localStorage.getItem(KEY);
        if (!stored) return defaults();
        const data = JSON.parse(stored);
        if (!Array.isArray(data.habits)) return defaults();
        return data;
    } catch (e) {
        return defaults();
    }
};

export const save = (data: any) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save data', e);
    }
};
