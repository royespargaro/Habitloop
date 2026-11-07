
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
        
        // Migrate checks: number[] -> { [day: number]: 'done' | 'skipped' }
        Object.keys(data.checks).forEach(mKey => {
            Object.keys(data.checks[mKey]).forEach(hId => {
                if (Array.isArray(data.checks[mKey][hId])) {
                    const newChecks: Record<string, 'done'> = {};
                    data.checks[mKey][hId].forEach((d: number) => {
                        newChecks[String(d)] = 'done';
                    });
                    data.checks[mKey][hId] = newChecks;
                }
            });
        });

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
