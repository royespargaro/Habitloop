import { useEffect, useRef } from 'react';
import './film-header.css';

interface FilmHeaderProps {
  priorities?: number;
  habitsLeft?: number;
  onStartFocus?: () => void;
  onAddTask?: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pad = (n: number) => String(n).padStart(2, '0');

export const FilmHeader = ({ priorities = 0, habitsLeft = 0, onStartFocus, onAddTask }: FilmHeaderProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let seconds = 0;
    const timer = window.setInterval(() => {
      seconds += 1;
      if (tcRef.current) tcRef.current.textContent = `00:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:00`;
    }, 1000);

    const canHover = window.matchMedia('(hover: hover)').matches;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--fhx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty('--fhy', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    };
    const leave = () => {
      el.style.setProperty('--fhx', '0');
      el.style.setProperty('--fhy', '0');
    };
    if (canHover) {
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
    }
    return () => {
      window.clearInterval(timer);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div className="fh-root" ref={rootRef}>
      <div className="fh-layer fh-bg" aria-hidden="true" />
      <div className="fh-ghost" aria-hidden="true">InPursuit</div>
      <div className="fh-layer fh-vig" aria-hidden="true" />
      <div className="fh-layer fh-grain" aria-hidden="true" />
      <div className="fh-hud" aria-hidden="true">
        <div className="fh-tags">
          <span className="fh-rec"><i />rec</span>
          <span>iso:400</span>
          <span>f/2.8</span>
          <span>1/60</span>
          <span ref={tcRef}>00:00:00:00</span>
        </div>
        <div>inpursuit_v2.0.0</div>
      </div>
      <div className="fh-orb" aria-hidden="true">
        <div className="fh-orb-body">
          <div className="fh-orb-glow" />
          <div className="fh-orb-glass">
            <span className="fh-orb-word">InPursuit</span>
            <div className="fh-orb-caustic" />
          </div>
          <div className="fh-flare" />
          <div className="fh-orb-shadow" />
        </div>
      </div>
      <div className="fh-copy">
        <div className="fh-eyebrow">today’s imperative</div>
        <h1 className="fh-title">today<span>.</span></h1>
        <p className="fh-text">
          {plural(priorities, 'priority', 'priorities')} to finalize. {plural(habitsLeft, 'habit', 'habits')} to maintain.
          Consistency is the only metric.
        </p>
        <div className="fh-btns">
          <button type="button" className="fh-btn fh-btn-solid" onClick={onStartFocus}>Start focus <b>→</b></button>
          <button type="button" className="fh-btn fh-btn-outline" onClick={onAddTask}>Add task</button>
        </div>
      </div>
    </div>
  );
};
