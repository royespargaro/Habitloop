
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
  const [filter, setFilter] = useState('All');
  const { data } = useHabits();

  const categories = Array.from(new Set(data.habits.map(h => h.category).filter(Boolean))) as string[];

  const dim = getDaysInMonth(year, month);
  const cur = now.getFullYear() === year && now.getMonth() === month;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <header className="flex items-center justify-between py-4 border-b border-[#2a2a30]">
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

      <section className="pt-6 sm:pt-8">
        <h1 className="head text-6xl sm:text-9xl leading-none mb-10">
          {MN[month].toLowerCase()} <b>{year}</b>
        </h1>
        
        <div className="mb-6 flex gap-2">
            <select className="bg-black border border-[#2a2a30] text-white p-2 text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="All">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </div>

        <HabitMatrix year={year} month={month} dim={dim} cur={cur} filter={filter} />
      </section>

      <Analytics year={year} month={month} dim={dim} />
      
      <footer className="mt-10 pt-5 border-t border-[#2a2a30] flex items-center justify-between gap-4">
        <span className="lbl">data stored locally on this device</span>
        <button className="btn" onClick={() => {
            const isDark = document.documentElement.classList.toggle('light');
        }}>Toggle Theme</button>
        <span className="flex items-center gap-2"><span className="head text-2xl">habit<b>loop</b></span></span>
      </footer>
      
      <HabitModal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} />
    </div>
  );
}
