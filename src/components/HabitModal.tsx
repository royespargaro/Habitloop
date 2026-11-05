
import React from 'react';
import { HabitManager } from './HabitManager';

export const HabitModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
            <div className="bg-black bd w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="head text-2xl font-bold">manage habits</h3>
                    <button className="btn" onClick={onClose}>close</button>
                </div>
                <HabitManager />
            </div>
        </div>
    );
};
