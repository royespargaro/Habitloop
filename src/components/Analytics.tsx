
import React from 'react';
import { useHabits } from '../context/HabitContext';
import { mk, pad } from '../utils/habitUtils';

export const Analytics = ({ year, month, dim }: { year: number, month: number, dim: number }) => {
    const { data } = useHabits();
    const now = new Date();
    const cur = now.getFullYear() === year && now.getMonth() === month;
    const past = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    const el = cur ? now.getDate() : past ? dim : 0;
    const den = el || dim;

    const getHabitCount = (habitId: string) => (data.checks[mk(year, month)] || {})[habitId]?.filter((d: number) => !el || d <= el).length || 0;

    const rank = data.habits.map(h => ({ name: h.name, c: getHabitCount(h.id) })).sort((a, b) => b.c - a.c);

    // Trend calculations
    const W = dim * 12;
    const ratios = [];
    for (let d = 1; d <= dim; d++) {
        let c = 0;
        data.habits.forEach(h => { if ((data.checks[mk(year, month)] || {})[h.id]?.includes(d)) c++; });
        ratios.push(data.habits.length ? c / data.habits.length : 0);
    }

    return (
        <section className="grid lg:grid-cols-2 gap-6 py-10">
            <div className="bd p-4 sm:p-6">
                <div className="flex items-end justify-between mb-5 gap-3"><h2 className="head text-3xl" style={{fontWeight:600}}>consistency trend</h2><div className="lbl">daily completion %</div></div>
                <div id="chart">
                    <div className="flex gap-3">
                        <div className="flex flex-col justify-between mono text-[11px] dim text-right" style={{height:170,width:30}}><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
                        <div className="flex-1 min-w-0">
                            <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="w-full block" style={{height:170}}>
                                {[0, 25, 50, 75, 100].map(v => <line key={v} x1="0" x2={W} y1={100 - v} y2={100 - v} stroke="#2a2a30" strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}
                                {ratios.map((r, i) => (
                                    <rect key={i} x={i * 12 + 2} y={100 - Math.max(r * 100, r ? 1 : 0)} width="8" height={Math.max(r * 100, r ? 1 : 0)} fill={cur && i + 1 === now.getDate() ? '#d4ff3a' : 'rgba(255,255,255,.5)'} />
                                ))}
                            </svg>
                            <div className="flex justify-between mono text-[11px] dim mt-2"><span>01</span><span>{pad(Math.ceil(dim / 2))}</span><span>{dim}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bd p-4 sm:p-6">
                <div className="flex items-end justify-between mb-5 gap-3"><h2 className="head text-3xl" style={{fontWeight:600}}>top habits</h2><div className="lbl">ranked by completion</div></div>
                <div className="space-y-5">
                    {rank.length ? rank.map((r, i) => {
                        const p = Math.round(r.c / (den || 1) * 100);
                        return (
                            <div key={i}>
                                <div className="flex justify-between items-baseline gap-3 mb-2">
                                    <span className="text-[14px]"><span className="mono dim mr-2 text-[12px]">{pad(i + 1)}</span>{r.name}</span>
                                    <span className="mono text-[13px] whitespace-nowrap">{r.c}/{den} · {p}%</span>
                                </div>
                                <div className="bar"><i style={{width: `${p}%`}}></i></div>
                            </div>
                        );
                    }) : <div className="dim text-sm">No habits yet.</div>}
                </div>
            </div>
        </section>
    );
};
