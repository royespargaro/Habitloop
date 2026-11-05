
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
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 border-b border-[#1a1a20]">
        <div className="flex items-center gap-2">
          <span className="head text-2xl">habit<b>loop</b></span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            className="btn"
            onClick={() => setMonth(m => { if (m === 0) { setYear(y => y - 1); return 11; } return m - 1; })}
            aria-label="Previous month"
          >
            ←
          </button>
          <button className="btn" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>
            today
          </button>
          <button
            className="btn"
            onClick={() => setMonth(m => { if (m === 11) { setYear(y => y + 1); return 0; } return m + 1; })}
            aria-label="Next month"
          >
            →
          </button>
          <button className="btn solid ml-2" onClick={() => setIsManageOpen(true)}>
            ( + ) habits
          </button>
        </nav>
      </header>

      {/* Cinematic slate — atmosphere confined to this frame only */}
      <section className="pt-6 sm:pt-8 px-4 sm:px-6">
        <div className="bd relative overflow-hidden" style={{ minHeight: 220 }}>
          <div className="film" aria-hidden="true">
            <i className="s1" />
            <i className="s2" />
            <i className="s3" />
            <i className="fx vig" />
          </div>
          <div className="lb relative z-10 flex items-center justify-between px-4 sm:px-6 pt-4">
            <span><span style={{ color: 'var(--accent)' }}>●</span> rec · habit reel</span>
            <span>{dim.toString().padStart(2, '0')} days logged</span>
          </div>
          <h1 className="head relative z-10 text-6xl sm:text-9xl leading-none mt-6 mb-6 px-4 sm:px-6">
            {MN[month].toLowerCase()} <b>{year}</b>
          </h1>
          <div className="lb relative z-10 flex items-center justify-between px-4 sm:px-6 pb-4">
            <span>scene: monthly log</span>
            <span>{data.habits.length.toString().padStart(2, '0')} active habits</span>
          </div>
        </div>

        <HabitMatrix year={year} month={month} dim={dim} cur={cur} />
      </section>

      <Analytics year={year} month={month} dim={dim} />

      <footer className="mt-10 pt-5 px-4 sm:px-6 pb-8 border-t border-[#1a1a20] flex items-center justify-between gap-4">
        <span className="lbl">data stored locally on this device</span>
        <span className="flex items-center gap-2"><span className="head text-2xl">habit<b>loop</b></span></span>
      </footer>

      <HabitModal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} />
    </div>
  );
}
