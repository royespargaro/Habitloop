import { useEffect, useRef } from 'react';
import './film-header.css';

export interface HeroGoalSummary {
  id: string;
  title: string;
  areaName: string;
  percent: number;
  completedTasks: number;
  totalTasks: number;
  targetDate: string;
}

interface FilmHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  scene?: string;
  goals?: HeroGoalSummary[];
  onReview?: () => void;
  onAddTask?: () => void;
  onOpenGoals?: () => void;
  onOpenGoal?: (goalId: string) => void;
  onAddGoal?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const FilmHeader = ({
  eyebrow,
  title,
  subtitle,
  scene = 'daily overview',
  goals = [],
  onReview,
  onAddTask,
  onOpenGoals,
  onOpenGoal,
  onAddGoal,
}: FilmHeaderProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    const matchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
    if (!el || matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const isFinePointer = matchMedia?.('(pointer: fine)').matches ?? false;
    if (!isFinePointer) return;

    let seconds = 0;
    let timer: number | null = null;
    const startTicker = () => {
      if (timer !== null || document.hidden) return;
      timer = window.setInterval(() => {
        seconds += 1;
        if (tcRef.current) tcRef.current.textContent = `00:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:00`;
      }, 1000);
    };
    const stopTicker = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stopTicker();
      else startTicker();
    };
    startTicker();
    document.addEventListener('visibilitychange', onVisibility);

    let rafId = 0;
    let pendingX = '0';
    let pendingY = '0';
    const commitParallax = () => {
      rafId = 0;
      el.style.setProperty('--fhx', pendingX);
      el.style.setProperty('--fhy', pendingY);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pendingX = (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3);
      pendingY = (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3);
      if (!rafId) rafId = window.requestAnimationFrame(commitParallax);
    };
    const leave = () => {
      pendingX = '0';
      pendingY = '0';
      if (!rafId) rafId = window.requestAnimationFrame(commitParallax);
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });

    return () => {
      stopTicker();
      if (rafId) window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  const handleGoalClick = (goalId: string) => {
    if (onOpenGoal) onOpenGoal(goalId);
    else onOpenGoals?.();
  };

  return (
    <div className="fh-root" ref={rootRef}>
      <div className="fh-layer fh-bg" aria-hidden="true" />
      <div className="fh-ghost" aria-hidden="true">InPursuit</div>
      <div className="fh-layer fh-vig" aria-hidden="true" />

      <div className="fh-hud" aria-hidden="true">
        <div className="fh-tags">
          <span className="fh-rec"><i />rec</span>
          <span>iso:400</span>
          <span>f/2.8</span>
          <span>1/60</span>
          <span ref={tcRef}>00:00:00:00</span>
        </div>
        <div className="fh-scene">{scene}</div>
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

      <div className="fh-lower">
        <div className="fh-copy">
          <div className="fh-eyebrow">{eyebrow}</div>
          <h1 className="fh-title">{title}<span>.</span></h1>
          <p className="fh-text">{subtitle}</p>
          <div className="fh-btns">
            <button type="button" className="fh-btn fh-btn-solid" onClick={onReview}>Daily review <b>→</b></button>
            <button type="button" className="fh-btn fh-btn-outline" onClick={onAddTask}>Add task</button>
          </div>
        </div>
      </div>

      <aside className="fh-horizon-bar" aria-label="Active goals progress">
        {goals.length > 0 ? (
          <>
            <div className="fh-horizon-rail">
              <span>goals · {goals.length} active</span>
              <button type="button" className="fh-goal-link" onClick={onOpenGoals}>
                {goals.length > 3 ? `All ${goals.length} goals →` : 'Open goals →'}
              </button>
            </div>
            <div className="fh-horizon-grid">
              {goals.slice(0, 3).map((goal, index) => (
                <button
                  key={goal.id}
                  type="button"
                  className="fh-horizon-cell"
                  onClick={() => handleGoalClick(goal.id)}
                >
                  <div className="fh-horizon-top">
                    <span className="fh-horizon-title">
                      <em>{pad(index + 1)}</em> {goal.title}
                    </span>
                    <span className="fh-horizon-right">
                      <small className="fh-horizon-count">{goal.completedTasks}/{goal.totalTasks}</small>
                      <strong className="fh-goal-pct">{goal.percent}%</strong>
                    </span>
                  </div>
                  <div className="fh-goal-track">
                    <i style={{ width: `${goal.percent}%` }} />
                  </div>
                  <div className="fh-horizon-meta">
                    <span>{goal.areaName}</span>
                    <span>{goal.completedTasks}/{goal.totalTasks} tasks</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="fh-horizon-empty">
            <span>No active goals synced yet</span>
            <button type="button" className="fh-goal-link" onClick={onAddGoal ?? onOpenGoals}>
              Set first goal →
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
