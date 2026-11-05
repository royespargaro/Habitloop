
export const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const mk = (y: number, m: number) => `${y}-${m + 1}`;

export const pad = (n: number) => String(n).padStart(2, '0');

export const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export const getStreak = (habitId: string, checks: any, now: Date) => {
    let streak = 0;
    let d = new Date(now);
    d.setDate(d.getDate() - 1);
    
    while(true) {
        const mKey = mk(d.getFullYear(), d.getMonth());
        const day = String(d.getDate());
        const status = checks[mKey] && checks[mKey][habitId] ? checks[mKey][habitId][day] : null;
        
        if (status === 'done') {
            streak++;
            d.setDate(d.getDate() - 1);
        } else if (status === 'skipped') {
            // Skipped days don't break streaks, just continue
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    
    const todayKey = mk(now.getFullYear(), now.getMonth());
    const todayStatus = checks[todayKey] && checks[todayKey][habitId] ? checks[todayKey][habitId][String(now.getDate())] : null;

    if (todayStatus === 'done') {
        streak++;
    }
    return streak;
};

export const getBestStreak = (habitId: string, checks: any) => {
    let best = 0;
    let current = 0;
    // Simplified: iterate through all recorded days (could be optimized)
    // For now, focus on streak calculation logic.
    return 0; // Placeholder for now, per strict requirements.
};
