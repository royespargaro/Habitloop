
import React, { useState } from 'react';
import { HabitMatrix } from './components/HabitMatrix';
import { Analytics } from './components/Analytics';
import { HabitModal } from './components/HabitModal';
import { MN, getDaysInMonth } from './utils/habitUtils';
import { useHabits } from './context/HabitContext';

export default function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [isManageOpen, setIsManageOpen] = useState(false);
  const { data } = useHabits();

  const dim = getDaysInMonth(year, month);
  const cur = now.getFullYear() === year && now.getMonth() === month;

  return (
    <div className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 border-b border-[#2a2a30]">
        <div className="flex items-center gap-2">
            <span className="head text-2xl">habit<b>loop</b></span>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setMonth(m => { if(m===0) { setYear(y=>y-1); return 11; } return m-1; })}>←</button>
          <button className="btn" onClick={() => {setYear(now.getFullYear()); setMonth(now.getMonth());}}>today</button>
          <button className="btn" onClick={() => setMonth(m => { if(m===11) { setYear(y=>y+1); return 0; } return m+1; })}>→</button>
          <button className="btn solid" onClick={() => setIsManageOpen(true)}>habits +</button>
        </div>
      </header>

      <section className="pt-6 sm:pt-8 px-4 sm:px-6">
        <h1 className="head text-6xl sm:text-9xl leading-none mb-10">
          {MN[month].toLowerCase()} <b>{year}</b>
        </h1>
        <HabitMatrix year={year} month={month} dim={dim} cur={cur} />
      </section>

      <Analytics year={year} month={month} dim={dim} />
      
      <footer className="mt-10 pt-5 border-t border-[#2a2a30] flex items-center justify-between gap-4">
        <span className="lbl">data stored locally on this device</span>
        <span className="flex items-center gap-2"><span className="head text-2xl">habit<b>loop</b></span></span>
      </footer>
      
      <HabitModal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} />
    </div>
  );
}
