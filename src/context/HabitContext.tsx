
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as storage from '../services/storage';

interface Habit { id: string; name: string; }
interface HabitData { habits: Habit[]; checks: Record<string, Record<string, number[]>>; nid: number; }

const HabitContext = createContext<{
    data: HabitData;
    setData: React.Dispatch<React.SetStateAction<HabitData>>;
    saveData: (data: HabitData) => void;
} | undefined>(undefined);

export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
    const [data, setData] = useState<HabitData>(storage.defaults());

    useEffect(() => {
        setData(storage.load());
    }, []);

    const saveData = (newData: HabitData) => {
        setData(newData);
        storage.save(newData);
    };

    return (
        <HabitContext.Provider value={{ data, setData, saveData }}>
            {children}
        </HabitContext.Provider>
    );
};

export const useHabits = () => {
    const context = useContext(HabitContext);
    if (!context) throw new Error('useHabits must be used within HabitProvider');
    return context;
};
