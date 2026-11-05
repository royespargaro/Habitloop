
import React, { useCallback } from 'react';
import { useHabits } from '../context/HabitContext';
import { mk, getStreak } from '../utils/habitUtils';

export const HabitMatrix = ({ year, month, dim, cur }: { year: number, month: number, dim: number, cur: boolean }) => {
    const { data, saveData } = useHabits();
    const now = new Date();

    const toggleCheck = useCallback((habitId: string, day: number) => {
        const k = mk(year, month);
        const monthChecks = data.checks[k] || {};
        const habitChecks = new Set(monthChecks[habitId] || []);

        if (habitChecks.has(day)) {
            habitChecks.delete(day);
        } else {
            habitChecks.add(day);
            if (navigator.vibrate) navigator.vibrate(10);
        }

        // Rebuild every level that changes — never mutate the previous
        // state object in place, or React can miss re-renders.
        saveData({
            ...data,
            checks: {
                ...data.checks,
                [k]: {
                    ...monthChecks,
                    [habitId]: Array.from(habitChecks).sort((a, b) => a - b),
                },
            },
        });
    }, [data, saveData, year, month]);

    return (
        <div className="scroll bd overflow-x-auto mt-4">
            <table id="matrix" className="border-collapse">
                <thead>
                    <tr>
                        <th className="name lbl text-left px-3 py-3 min-w-[150px] font-normal">habit</th>
                        {[...Array(dim)].map((_, i) => (
                            <th key={i} className={`mono text-[11px] font-bold w-[32px] py-3 text-center ${cur && i + 1 === now.getDate() ? 'today' : 'dim'}`}>
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
                                <td className="name text-[14px] px-3 border-t border-[#1a1a20] whitespace-nowrap">{h.name}</td>
                                {[...Array(dim)].map((_, i) => {
                                    const day = i + 1;
                                    const on = set.has(day);
                                    return (
                                        <td key={day} className="p-0 border-t border-[#1a1a20]">
                                            <button
                                                type="button"
                                                className={`cell ${on ? 'on' : ''}`}
                                                onClick={() => toggleCheck(h.id, day)}
                                                aria-label={`${h.name} day ${day}`}
                                                aria-pressed={on}
                                            />
                                        </td>
                                    );
                                })}
                                <td className="mono text-[13px] px-3 text-right border-t border-[#1a1a20]">{getStreak(h.id, data.checks, now)}</td>
                            </tr>
                        );
                    })}
                    {!data.habits.length && (
                        <tr>
                            <td className="name px-3 py-6 dim text-sm" colSpan={dim + 2}>no habits — ( + ) add one above</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
