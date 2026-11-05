
import React from 'react';
import { useHabits } from '../context/HabitContext';
import { mk, getStreak } from '../utils/habitUtils';

export const HabitMatrix = ({ year, month, dim, cur }: { year: number, month: number, dim: number, cur: boolean }) => {
    const { data, saveData } = useHabits();
    const now = new Date();

    const toggleCheck = (habitId: string, day: number) => {
        const newData = { ...data };
        const k = mk(year, month);
        newData.checks[k] = { ...newData.checks[k] };
        const habitChecks = new Set(newData.checks[k][habitId] || []);
        
        if (habitChecks.has(day)) {
            habitChecks.delete(day);
        } else {
            habitChecks.add(day);
            if (navigator.vibrate) navigator.vibrate(10);
        }
        
        newData.checks[k][habitId] = Array.from(habitChecks).sort((a, b) => a - b);
        saveData(newData);
    };

    return (
        <div className="scroll bd overflow-x-auto">
            <table id="matrix" className="border-collapse">
                <thead>
                    <tr>
                        <th className="name lbl text-left px-3 py-2 min-w-[150px] font-normal">habit</th>
                        {[...Array(dim)].map((_, i) => (
                            <th key={i} className={`mono text-[11px] font-bold w-[32px] py-2 text-center ${cur && i + 1 === now.getDate() ? 'today' : 'dim'}`}>
                                {i + 1}
                            </th>
                        ))}
                        <th className="lbl px-3 text-right font-normal">streak</th>
                    </tr>
                </thead>
                <tbody>
                    {data.habits.map(h => {
                        const set = new Set((data.checks[mk(year, month)] || {})[h.id] || []);
                        return (
                            <tr key={h.id}>
                                <td className="name text-[14px] px-3 border-t border-[#2a2a30] whitespace-nowrap">{h.name}</td>
                                {[...Array(dim)].map((_, i) => {
                                    const day = i + 1;
                                    return (
                                        <td key={day} className="p-0 border-t border-[#2a2a30]">
                                            <button 
                                                className={`cell ${set.has(day) ? 'on' : ''}`} 
                                                onClick={() => toggleCheck(h.id, day)}
                                                aria-label={`${h.name} day ${day}`}
                                            />
                                        </td>
                                    );
                                })}
                                <td className="mono text-[13px] px-3 text-right border-t border-[#2a2a30]">{getStreak(h.id, data.checks, now)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
