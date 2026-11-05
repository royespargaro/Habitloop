
import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

export const HabitManager = () => {
    const { data, saveData } = useHabits();
    const [newName, setNewName] = useState('');
    const [newCat, setNewCat] = useState('');

    const addHabit = () => {
        if (!newName.trim()) return;
        saveData({
            ...data,
            habits: [...data.habits, { id: 'h' + data.nid, name: newName.trim(), category: newCat.trim() || undefined }],
            nid: data.nid + 1
        });
        setNewName('');
        setNewCat('');
    };

    const removeHabit = (id: string) => {
        const newData = { ...data, habits: data.habits.filter(h => h.id !== id) };
        Object.values(newData.checks).forEach(m => delete m[id]);
        saveData(newData);
    };

    const exportData = () => {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'habitloop_backup.json';
        a.click();
    };

    const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                if (Array.isArray(parsed.habits)) saveData(parsed);
                else alert('Invalid backup file');
            } catch (e) { alert('Invalid backup file'); }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <input className="f" value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} placeholder="New habit name…" />
                <input className="f" value={newCat} onChange={e => setNewCat(e.target.value)} maxLength={20} placeholder="Category (optional)…" />
                <button className="btn solid w-full" onClick={addHabit}>add</button>
            </div>
            <ul className="border-t border-[#2a2a30]">
                {data.habits.map(h => (
                    <li key={h.id} className="flex items-center justify-between py-3 border-b border-[#2a2a30]">
                        <div className="flex flex-col">
                            <span className="text-[14px]">{h.name}</span>
                            {h.category && <span className="text-[10px] text-gray-500 uppercase">{h.category}</span>}
                        </div>
                        <button className="btn" onClick={() => removeHabit(h.id)}>remove</button>
                    </li>
                ))}
            </ul>
            <div className="flex gap-2">
                <button className="btn flex-1" onClick={exportData}>export</button>
                <label className="btn flex-1 text-center cursor-pointer">
                    import<input type="file" onChange={importData} accept=".json" className="hidden" />
                </label>
            </div>
            <button className="btn w-full" onClick={() => saveData({ habits: [], checks: {}, nid: 0 })}>reset all</button>
        </div>
    );
};
