
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
        const day = d.getDate();
        if ((checks[mKey] && checks[mKey][habitId] && checks[mKey][habitId].includes(day))) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    
    const todayKey = mk(now.getFullYear(), now.getMonth());
    const isTodayCompleted = (checks[todayKey] && checks[todayKey][habitId] && checks[todayKey][habitId].includes(now.getDate()));
    
    if (!isTodayCompleted) return 0;
    
    return streak + 1;
};
