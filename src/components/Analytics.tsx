
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
    const ratios: number[] = [];
    for (let d = 1; d <= dim; d++) {
        let c = 0;
        data.habits.forEach(h => { if ((data.checks[mk(year, month)] || {})[h.id]?.includes(d)) c++; });
        ratios.push(data.habits.length ? c / data.habits.length : 0);
    }
    const linePoints = ratios.map((r, i) => `${i * 12 + 6},${100 - r * 100}`).join(' ');
    const areaPath = ratios.length
        ? `M0,100 ${ratios.map((r, i) => `L${i * 12 + 6},${100 - r * 100}`).join(' ')} L${(ratios.length - 1) * 12 + 6},100 Z`
        : '';

    return (
        <section className="grid lg:grid-cols-2 gap-px bg-[#1a1a20] border border-[#1a1a20] mx-4 sm:mx-6 mt-10">
            <div className="bg-black p-4 sm:p-6">
                <div className="flex items-end justify-between mb-6 gap-3">
                    <h2 className="head text-3xl sm:text-4xl">consistency trend</h2>
                    <div className="lbl">daily completion %</div>
                </div>
                <div id="chart">
                    <div className="flex gap-3">
                        <div className="lbl flex flex-col justify-between text-right" style={{ height: 170, width: 28 }}>
                            <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="w-full block" style={{ height: 170 }}>
                                <defs>
                                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ccff00" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#ccff00" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {[0, 25, 50, 75, 100].map(v => (
                                    <line key={v} x1="0" x2={W} y1={100 - v} y2={100 - v} stroke="#1a1a20" strokeWidth={v === 0 ? 1 : 0.5} vectorEffect="non-scaling-stroke" />
                                ))}
                                {cur && (
                                    <line
                                        x1={(now.getDate() - 1) * 12 + 6} x2={(now.getDate() - 1) * 12 + 6}
                                        y1="0" y2="100"
                                        stroke="#ccff00" strokeWidth="1" strokeDasharray="2,3" opacity="0.6"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                )}
                                {areaPath && <path d={areaPath} fill="url(#trendFill)" stroke="none" />}
                                {ratios.map((r, i) => (
                                    <rect
                                        key={i}
                                        x={i * 12 + 2}
                                        y={100 - Math.max(r * 100, r ? 1 : 0)}
                                        width="8"
                                        height={Math.max(r * 100, r ? 1 : 0)}
                                        fill={cur && i + 1 === now.getDate() ? '#ccff00' : 'rgba(255,255,255,.35)'}
                                    />
                                ))}
                                {linePoints && <polyline points={linePoints} fill="none" stroke="#fff" strokeWidth="1.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                            </svg>
                            <div className="lbl flex justify-between mt-3"><span>01</span><span>{pad(Math.ceil(dim / 2))}</span><span>{dim}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-black p-4 sm:p-6">
                <div className="flex items-end justify-between mb-6 gap-3">
                    <h2 className="head text-3xl sm:text-4xl">top habits</h2>
                    <div className="lbl">ranked by completion</div>
                </div>
                <div className="space-y-5">
                    {rank.length ? rank.map((r, i) => {
                        const p = Math.round(r.c / (den || 1) * 100);
                        return (
                            <div key={i}>
                                <div className="flex justify-between items-baseline gap-3 mb-2">
                                    <span className="text-[14px]"><span className="lbl mr-3">{pad(i + 1)}</span>{r.name}</span>
                                    <span className="mono text-[12px] dim whitespace-nowrap">{r.c}/{den} · {p}%</span>
                                </div>
                                <div className={`bar ${i === 0 && p > 0 ? 'lead' : ''}`}><i style={{ width: `${p}%` }} /></div>
                            </div>
                        );
                    }) : <div className="dim text-sm">no habits yet.</div>}
                </div>
            </div>
        </section>
    );
};
