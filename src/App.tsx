import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrainDumpModal } from './components/BrainDumpModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ConflictModal } from './components/ConflictModal';
import { FilmHeader } from './components/FilmHeader';
import { SettingsModal } from './components/SettingsModal';
import { SignInPage } from './components/SignInPage';
import { SyncIndicator } from './components/SyncIndicator';
import { useHabits } from './context/HabitContext';
import {
  Activity, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, Flag, FolderKanban, Plus, Settings2, Sparkles, Target, Trash2, User, X,
} from './components/Icon';
import Icon from './components/Icon';
import type { AppData, BrainDumpPreview, DailyReview, Goal, Habit, Priority, Project, Status, Task } from './types';
import { createId, exportData, inspectBackupText, type ParsedBackup } from './services/appStore';
import { getBestStreak, getStreak, isHabitScheduledOnDate, localDateKey } from './utils/habitUtils';
import { getGoalProgress, getHabitConsistency, getNeglectedProjects, getWeeklyReflectionSummary } from './utils/intelligence';
import { canActivateProject, MAX_ACTIVE_PROJECTS } from './utils/projectLimits';

type View = 'today' | 'goals' | 'projects' | 'habits' | 'review';
type DeleteTarget = { kind: 'task' | 'goal' | 'project' | 'habit'; id: string; title: string };

const LOCAL_MODE_STORAGE_KEY = 'inpursuit.local_mode';

const prettyDate = (value: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', options);
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const uid = createId;
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

function readLocalModeFlag(): boolean {
  try {
    return sessionStorage.getItem(LOCAL_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLocalModeFlag(enabled: boolean) {
  try {
    if (enabled) sessionStorage.setItem(LOCAL_MODE_STORAGE_KEY, '1');
    else sessionStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
  } catch {
    // Ignore restricted sessionStorage
  }
}

function Button({ children, onClick, variant = 'ghost', className = '', title, type = 'button', disabled = false }: {
  children: ReactNode; onClick?: () => void; variant?: 'ghost' | 'solid' | 'outline' | 'danger';
  className?: string; title?: string; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx('ui-btn', `ui-btn-${variant}`, className)}>{children}</button>;
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children}</div>;
}

function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><Sparkles size={19}/></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close modal" onClick={onClose}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Progress({ value, tone = 'lime' }: { value: number; tone?: 'lime' | 'blue' }) {
  return <div className="progress-track"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div>;
}

export default function App() {
  const {
    data,
    updateData,
    saveData,
    user,
    authReady,
    syncStatus,
    lastSyncedAt,
    pendingSync,
    conflict,
    resolveConflict,
    retrySync,
    storageNotice,
  } = useHabits();

  const [localWorkspaceActive, setLocalWorkspaceActive] = useState<boolean>(readLocalModeFlag);
  const [today, setToday] = useState<string>(() => localDateKey());
  const [view, setView] = useState<View>('today');
  const [modal, setModal] = useState<'task' | 'goal' | 'project' | 'habit' | 'review' | 'settings' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewDate, setReviewDate] = useState<string>(() => localDateKey());
  const [toast, setToast] = useState('');
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ParsedBackup | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Midnight & tab-focus date transition check
  useEffect(() => {
    const syncDate = () => {
      const current = localDateKey();
      setToday(prev => (prev === current ? prev : current));
    };
    const interval = window.setInterval(syncDate, 60_000);
    window.addEventListener('visibilitychange', syncDate);
    window.addEventListener('focus', syncDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('visibilitychange', syncDate);
      window.removeEventListener('focus', syncDate);
    };
  }, []);

  const avatarPhotoUrl = user?.photoURL && user.photoURL !== failedPhotoUrl ? user.photoURL : null;

  const todayPlan = data.dailyPlans.find(p => p.date === today) ?? { date: today, priorityTaskIds: [] };
  const todayTasks = data.tasks.filter(t => t.dueDate === today && t.status !== 'skipped');
  const overdueTasks = data.tasks.filter(t => t.status === 'todo' && t.dueDate !== '' && t.dueDate < today);
  const activeHabits = data.habits.filter(h => h.active && isHabitScheduledOnDate(h, today));
  const todayHabitLogMap = new Map(data.habitLogs.filter(l => l.date === today).map(l => [l.habitId, l.status]));
  const completedHabitIds = new Set(activeHabits.filter(h => todayHabitLogMap.get(h.id) === 'done').map(h => h.id));
  const skippedHabitIds = new Set(activeHabits.filter(h => todayHabitLogMap.get(h.id) === 'skipped').map(h => h.id));
  const doneHabits = completedHabitIds.size;
  const scheduledNonSkippedHabits = activeHabits.filter(h => !skippedHabitIds.has(h.id)).length;
  const completedToday = todayTasks.filter(t => t.status === 'done').length;
  const priorityTasks = todayPlan.priorityTaskIds
    .map(id => data.tasks.find(t => t.id === id))
    .filter((t): t is Task => !!t && t.status !== 'skipped');
  const activeGoals = data.goals.filter(g => g.status === 'active');
  const activeProjects = data.projects.filter(p => p.status === 'active');
  const totalActionsDenominator = scheduledNonSkippedHabits + todayTasks.length;
  const completion = totalActionsDenominator === 0 ? 0 : Math.round(((doneHabits + completedToday) / totalActionsDenominator) * 100);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const setHabitStatusOnDate = (habit: Habit, date: string, nextStatus: 'done' | 'skipped' | 'clear') => {
    updateData(current => {
      if (date > today) return current;
      const filtered = current.habitLogs.filter(l => !(l.habitId === habit.id && l.date === date));
      if (nextStatus === 'clear') return { ...current, habitLogs: filtered };
      return { ...current, habitLogs: [...filtered, { id: uid(), habitId: habit.id, date, status: nextStatus }] };
    });
  };

  const toggleHabit = (habit: Habit) => {
    const currentStatus = todayHabitLogMap.get(habit.id);
    setHabitStatusOnDate(habit, today, currentStatus === 'done' ? 'clear' : 'done');
  };

  const toggleSkipHabit = (habit: Habit) => {
    const currentStatus = todayHabitLogMap.get(habit.id);
    setHabitStatusOnDate(habit, today, currentStatus === 'skipped' ? 'clear' : 'skipped');
  };

  const cycleHabitMatrixDay = (habit: Habit, date: string) => {
    const current = data.habitLogs.find(l => l.habitId === habit.id && l.date === date)?.status;
    if (!current) setHabitStatusOnDate(habit, date, 'done');
    else if (current === 'done') setHabitStatusOnDate(habit, date, 'skipped');
    else setHabitStatusOnDate(habit, date, 'clear');
  };

  const toggleTask = (task: Task) =>
    updateData(current => ({
      ...current,
      tasks: current.tasks.map(t =>
        t.id === task.id
          ? { ...t, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() }
          : t,
      ),
    }));

  const moveTaskToToday = (taskId: string) => {
    updateData(current => ({
      ...current,
      tasks: current.tasks.map(t => (t.id === taskId ? { ...t, dueDate: today } : t)),
    }));
    notify('Moved task to today');
  };

  const setPriorities = (ids: string[]) =>
    updateData(current => ({
      ...current,
      dailyPlans: [...current.dailyPlans.filter(p => p.date !== today), { date: today, priorityTaskIds: [...new Set(ids)].slice(0, 3) }],
    }));

  const openModal = (kind: NonNullable<typeof modal>, id?: string, targetReviewDate?: string) => {
    setEditingId(id ?? null);
    if (kind === 'review') setReviewDate(targetReviewDate ?? today);
    setModal(kind);
  };

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
    setNewTaskProjectId(null);
  };

  const requestDelete = (kind: DeleteTarget['kind'], id: string, title: string) => {
    setDeleteTarget({ kind, id, title });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { kind, id } = deleteTarget;
    updateData(current => {
      if (kind === 'task') {
        return {
          ...current,
          tasks: current.tasks.filter(x => x.id !== id),
          dailyPlans: current.dailyPlans.map(p => ({ ...p, priorityTaskIds: p.priorityTaskIds.filter(x => x !== id) })),
        };
      }
      if (kind === 'goal') {
        return {
          ...current,
          goals: current.goals.filter(x => x.id !== id),
          projects: current.projects.map(p => (p.goalId === id ? { ...p, goalId: null } : p)),
        };
      }
      if (kind === 'project') {
        return {
          ...current,
          projects: current.projects.filter(x => x.id !== id),
          tasks: current.tasks.map(t => (t.projectId === id ? { ...t, projectId: null } : t)),
        };
      }
      return {
        ...current,
        habits: current.habits.filter(x => x.id !== id),
        habitLogs: current.habitLogs.filter(x => x.habitId !== id),
      };
    });
    setDeleteTarget(null);
    notify(`${kind[0].toUpperCase() + kind.slice(1)} deleted`);
  };

  const handleImportSelect = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = inspectBackupText(await file.text());
      setPendingRestore(parsed);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Backup file could not be read');
    }
    if (importRef.current) importRef.current.value = '';
  };

  const confirmRestoreBackup = () => {
    if (!pendingRestore) return;
    saveData(pendingRestore.data);
    setPendingRestore(null);
    notify('Backup restored successfully');
  };

  const importBrainDump = (items: BrainDumpPreview) => {
    const now = new Date().toISOString();
    const keyOf = (value: string) => value.trim().toLocaleLowerCase();
    const existingProjectNames = new Set(data.projects.map(project => keyOf(project.title)));
    const projectCandidates = [...new Set(items.projects.map(project => keyOf(project.title)).filter(name => name && !existingProjectNames.has(name)))];
    const activeProjectCount = data.projects.filter(project => project.status === 'active').length;
    const availableProjectSlots = Math.max(0, MAX_ACTIVE_PROJECTS - activeProjectCount);
    const allowedProjectNames = new Set(projectCandidates.slice(0, availableProjectSlots));
    const skippedProjectNames = new Set(projectCandidates.slice(availableProjectSlots));
    const skippedTaskCount = items.tasks.filter(task => task.projectTitle && skippedProjectNames.has(keyOf(task.projectTitle))).length;

    updateData(current => {
      const lifeAreas = [...current.lifeAreas];
      const lifeAreaIds = new Map(lifeAreas.map(area => [keyOf(area.name), area.id]));
      items.lifeAreas.forEach(area => {
        const key = keyOf(area.name);
        if (!lifeAreaIds.has(key)) {
          const created = { id: uid(), name: area.name.trim(), description: area.description.trim(), createdAt: now };
          lifeAreas.push(created);
          lifeAreaIds.set(key, created.id);
        }
      });

      const goals = [...current.goals];
      const goalIds = new Map(goals.map(goal => [keyOf(goal.title), goal.id]));
      items.goals.forEach(goal => {
        const key = keyOf(goal.title);
        if (!goalIds.has(key)) {
          const created = {
            id: uid(),
            lifeAreaId: lifeAreaIds.get(keyOf(goal.lifeAreaName)) ?? null,
            title: goal.title.trim(),
            outcome: goal.outcome.trim(),
            targetDate: goal.targetDate,
            status: 'active' as const,
            createdAt: now,
          };
          goals.push(created);
          goalIds.set(key, created.id);
        }
      });

      const projects = [...current.projects];
      const projectIds = new Map(projects.map(project => [keyOf(project.title), project.id]));
      items.projects.forEach(project => {
        const key = keyOf(project.title);
        if (!projectIds.has(key) && allowedProjectNames.has(key)) {
          const created = {
            id: uid(),
            goalId: goalIds.get(keyOf(project.goalTitle)) ?? null,
            title: project.title.trim(),
            description: project.description.trim(),
            dueDate: project.dueDate,
            status: 'active' as const,
            createdAt: now,
          };
          projects.push(created);
          projectIds.set(key, created.id);
        }
      });

      const tasks = [...current.tasks];
      const taskKeys = new Set(tasks.map(task => `${keyOf(task.title)}:${task.projectId ?? ''}`));
      items.tasks.forEach(task => {
        if (task.projectTitle && skippedProjectNames.has(keyOf(task.projectTitle))) return;
        const projectId = projectIds.get(keyOf(task.projectTitle)) ?? null;
        const key = `${keyOf(task.title)}:${projectId ?? ''}`;
        if (!taskKeys.has(key)) {
          tasks.push({
            id: uid(),
            projectId,
            title: task.title.trim(),
            dueDate: task.dueDate,
            priority: task.priority,
            status: 'todo',
            createdAt: now,
            completedAt: null,
          });
          taskKeys.add(key);
        }
      });

      const habits = [...current.habits];
      const habitNames = new Set(habits.map(habit => keyOf(habit.name)));
      items.habits.forEach(habit => {
        const key = keyOf(habit.name);
        if (!habitNames.has(key)) {
          habits.push({ id: uid(), name: habit.name.trim(), frequency: habit.frequency, active: true, createdAt: now });
          habitNames.add(key);
        }
      });

      return { ...current, lifeAreas, goals, projects, tasks, habits };
    });

    setBrainDumpOpen(false);
    notify(
      skippedProjectNames.size
        ? `${skippedProjectNames.size} project(s) and ${skippedTaskCount} linked task(s) held back by the ${MAX_ACTIVE_PROJECTS}-project focus limit.`
        : 'Approved items added to InPursuit',
    );
  };

  const nav = [
    { id: 'today' as const, label: 'Today', icon: 'today' as const },
    { id: 'goals' as const, label: 'Goals', icon: 'goals' as const, count: activeGoals.length },
    { id: 'projects' as const, label: 'Projects', icon: 'projects' as const, count: activeProjects.length },
    { id: 'habits' as const, label: 'Habits', icon: 'habits' as const },
    { id: 'review' as const, label: 'Review', icon: 'review' as const },
  ];
  const currentTitle = nav.find(n => n.id === view)?.label ?? 'Today';

  if (!authReady) {
    return (
      <div className="auth-boot-shell" aria-busy="true">
        <div className="auth-boot-mark">
          <img className="brand-mark" src="/inpursuit-mark.svg" alt="InPursuit" />
        </div>
      </div>
    );
  }

  if (!user && !localWorkspaceActive) {
    return (
      <SignInPage
        onContinueLocal={() => {
          writeLocalModeFlag(true);
          setLocalWorkspaceActive(true);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="InPursuit home" onClick={e => { e.preventDefault(); setView('today'); }}>
          <img className="brand-mark" src="/inpursuit-mark.svg" alt="" />
          <img className="brand-wordmark" src="/inpursuit-wordmark.svg" alt="InPursuit" />
        </a>
        <div className="side-label">workspace</div>
        <nav className="side-nav" aria-label="Workspace views">
          {nav.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cx('nav-item', view === item.id && 'active')}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className="nav-item-icon"><Icon name={item.icon} size={17} /></span>
              <span className="nav-item-label">{item.label}</span>
              {item.count !== undefined && <small>{item.count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="focus-card">
            <div className="focus-icon"><Icon name="zap" size={15} /></div>
            <div>
              <strong>Make it happen.</strong>
              <p>Small actions. Real evidence.</p>
            </div>
          </div>
          <div className="sidebar-actions">
            <button type="button" onClick={() => exportData(data)}>
              <Icon name="download" size={15} /> Export backup
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              <Icon name="upload" size={15} /> Restore backup
            </button>
          </div>
          <SyncIndicator
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            pendingSync={pendingSync}
            onRetry={() => void retrySync()}
            onOpenSettings={() => setModal('settings')}
          />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <img className="brand-mark" src="/inpursuit-mark.svg" alt="" />
            <img className="brand-wordmark" src="/inpursuit-wordmark.svg" alt="InPursuit" />
          </div>
          <div className="breadcrumbs">
            workspace <Icon name="chevron-right" size={13} /> <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-right">
            <button className="icon-btn brain-dump-trigger" type="button" title="AI brain dump" aria-label="Open AI brain dump" onClick={() => setBrainDumpOpen(true)}>
              <Icon name="spark" size={16} />
            </button>
            <span className="date-chip">
              <Icon name="calendar" size={14} />
              {prettyDate(today, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="avatar" type="button" onClick={() => setModal('settings')} aria-label="Open settings">
              {avatarPhotoUrl ? (
                <img
                  className="avatar-img"
                  src={avatarPhotoUrl}
                  alt={user?.displayName ?? user?.email ?? 'Account profile'}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedPhotoUrl(avatarPhotoUrl)}
                />
              ) : (
                <User size={16} />
              )}
            </button>
          </div>
        </header>

        <input ref={importRef} type="file" accept="application/json" hidden onChange={e => void handleImportSelect(e.target.files?.[0])} />
        <div className="content-wrap">
          {user && (syncStatus === 'error' || (syncStatus === 'offline' && pendingSync)) && (
            <div className="mobile-sync-banner" role="status">
              <span>
                {syncStatus === 'error'
                  ? 'Cloud sync failed · changes saved on this device'
                  : 'Offline · changes queued for upload'}
              </span>
              <button type="button" className="sync-retry-btn" onClick={() => void retrySync()}>
                Retry
              </button>
            </div>
          )}
          {view === 'today' && (
            <TodayView
              data={data}
              today={today}
              todayTasks={todayTasks}
              overdueTasks={overdueTasks}
              activeHabits={activeHabits}
              completedHabitIds={completedHabitIds}
              skippedHabitIds={skippedHabitIds}
              doneHabits={doneHabits}
              scheduledHabitsCount={scheduledNonSkippedHabits}
              priorityTasks={priorityTasks}
              priorityIds={todayPlan.priorityTaskIds}
              completion={completion}
              completedToday={completedToday}
              onToggleHabit={toggleHabit}
              onToggleSkipHabit={toggleSkipHabit}
              onToggleTask={toggleTask}
              onMoveToToday={moveTaskToToday}
              onPriorities={setPriorities}
              onAddTask={() => openModal('task')}
              onEditTask={id => openModal('task', id)}
              onReview={() => openModal('review', undefined, today)}
            />
          )}
          {view === 'goals' && (
            <GoalsView
              goals={data.goals}
              lifeAreas={data.lifeAreas}
              projects={data.projects}
              tasks={data.tasks}
              onAdd={() => openModal('goal')}
              onEdit={id => openModal('goal', id)}
              onDelete={(id, title) => requestDelete('goal', id, title)}
            />
          )}
          {view === 'projects' && (
            <ProjectsView
              projects={data.projects}
              goals={data.goals}
              tasks={data.tasks}
              onAdd={() => openModal('project')}
              onEdit={id => openModal('project', id)}
              onDelete={(id, title) => requestDelete('project', id, title)}
              onAddTask={id => {
                setNewTaskProjectId(id);
                openModal('task');
              }}
              onToggleTask={toggleTask}
              onEditTask={id => openModal('task', id)}
            />
          )}
          {view === 'habits' && (
            <HabitsView
              habits={data.habits}
              logs={data.habitLogs}
              completedHabitIds={completedHabitIds}
              today={today}
              onAdd={() => openModal('habit')}
              onEdit={id => openModal('habit', id)}
              onDelete={(id, title) => requestDelete('habit', id, title)}
              onToggle={cycleHabitMatrixDay}
            />
          )}
          {view === 'review' && (
            <ReviewView
              data={data}
              today={today}
              onWrite={(targetDate?: string) => openModal('review', undefined, targetDate ?? today)}
            />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {nav.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={cx('mobile-nav-item', view === item.id && 'active')}
            aria-current={view === item.id ? 'page' : undefined}
          >
            <span className="mobile-nav-icon"><Icon name={item.icon} size={19} /></span>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {modal && modal !== 'settings' && (
        <EditorModal
          kind={modal}
          id={editingId}
          reviewDate={reviewDate}
          today={today}
          data={data}
          activeProjectCount={activeProjects.length}
          newTaskProjectId={newTaskProjectId}
          onClose={closeModal}
          onCreateLifeArea={name => {
            const trimmed = name.trim();
            if (!trimmed) return '';
            const existing = data.lifeAreas.find(a => a.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
            if (existing) return existing.id;
            const createdId = uid();
            updateData(current => ({
              ...current,
              lifeAreas: [...current.lifeAreas, { id: createdId, name: trimmed, description: '', createdAt: new Date().toISOString() }],
            }));
            return createdId;
          }}
          onDeleteItem={(kind, id, title) => {
            closeModal();
            requestDelete(kind, id, title);
          }}
          onSave={(kind, value) => {
            if (kind === 'project') {
              const project = value as Project;
              if (project.status === 'active' && !canActivateProject(data.projects, project.id)) {
                notify(`Active project limit reached (${MAX_ACTIVE_PROJECTS}). Complete or archive a project first.`);
                return;
              }
            }
            updateData(current => {
              if (kind === 'task') {
                const item = value as Task;
                return { ...current, tasks: current.tasks.some(x => x.id === item.id) ? current.tasks.map(x => (x.id === item.id ? item : x)) : [...current.tasks, item] };
              }
              if (kind === 'goal') {
                const item = value as Goal;
                return { ...current, goals: current.goals.some(x => x.id === item.id) ? current.goals.map(x => (x.id === item.id ? item : x)) : [...current.goals, item] };
              }
              if (kind === 'project') {
                const item = value as Project;
                return { ...current, projects: current.projects.some(x => x.id === item.id) ? current.projects.map(x => (x.id === item.id ? item : x)) : [...current.projects, item] };
              }
              if (kind === 'habit') {
                const item = value as Habit;
                return { ...current, habits: current.habits.some(x => x.id === item.id) ? current.habits.map(x => (x.id === item.id ? item : x)) : [...current.habits, item] };
              }
              const item = value as DailyReview;
              return { ...current, dailyReviews: [...current.dailyReviews.filter(x => x.date !== item.date), item] };
            });
            closeModal();
            notify('Saved');
          }}
        />
      )}

      {modal === 'settings' && (
        <SettingsModal
          onClose={closeModal}
          onExportBackup={() => exportData(data)}
          onRestoreBackup={() => importRef.current?.click()}
          onOpenSignIn={() => {
            writeLocalModeFlag(false);
            setLocalWorkspaceActive(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          eyebrow={`delete ${deleteTarget.kind}`}
          title={`Delete "${deleteTarget.title}"?`}
          body={
            deleteTarget.kind === 'goal'
              ? 'Linked projects will be unlinked (kept intact). This cannot be undone.'
              : deleteTarget.kind === 'project'
                ? 'Linked tasks will become personal/unassigned tasks. This cannot be undone.'
                : deleteTarget.kind === 'habit'
                  ? 'All historical completion logs for this habit will also be removed.'
                  : 'This task will be removed from your workspace and any daily plans.'
          }
          confirmLabel={`Delete ${deleteTarget.kind}`}
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {pendingRestore && (
        <ConfirmModal
          eyebrow="restore backup"
          title="Replace current workspace with backup?"
          body={
            pendingRestore.exportedAt
              ? `Backup exported on ${new Date(pendingRestore.exportedAt).toLocaleString()}. Continuing will replace your current workspace.`
              : 'Continuing will replace your current workspace with this backup file.'
          }
          details={[
            `${pendingRestore.summary.goals} goals · ${pendingRestore.summary.projects} projects · ${pendingRestore.summary.tasks} tasks`,
            `${pendingRestore.summary.habits} habits · ${pendingRestore.summary.habitLogs} logs · ${pendingRestore.summary.dailyReviews} reviews`,
          ]}
          confirmLabel="Restore backup"
          tone="solid"
          onConfirm={confirmRestoreBackup}
          onCancel={() => setPendingRestore(null)}
        />
      )}

      {conflict && <ConflictModal conflict={conflict} onResolve={resolveConflict} />}

      {toast && <div className="toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
      {storageNotice && <div className="storage-warning" role="status">{storageNotice}</div>}

      {brainDumpOpen && (
        <BrainDumpModal
          existingData={data}
          onClose={() => setBrainDumpOpen(false)}
          onImport={importBrainDump}
        />
      )}
    </div>
  );
}

function TodayView({
  data, today, todayTasks, overdueTasks, activeHabits, completedHabitIds, skippedHabitIds, doneHabits, scheduledHabitsCount,
  priorityTasks, priorityIds, completion, completedToday,
  onToggleHabit, onToggleSkipHabit, onToggleTask, onMoveToToday, onPriorities, onAddTask, onEditTask, onReview,
}: {
  data: AppData; today: string; todayTasks: Task[]; overdueTasks: Task[]; activeHabits: Habit[];
  completedHabitIds: Set<string>; skippedHabitIds: Set<string>; doneHabits: number; scheduledHabitsCount: number;
  priorityTasks: Task[]; priorityIds: string[]; completion: number; completedToday: number;
  onToggleHabit: (h: Habit) => void; onToggleSkipHabit: (h: Habit) => void;
  onToggleTask: (t: Task) => void; onMoveToToday: (id: string) => void;
  onPriorities: (ids: string[]) => void; onAddTask: () => void; onEditTask: (id: string) => void; onReview: () => void;
}) {
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const available = data.tasks.filter(
    t => t.status !== 'skipped' && t.status !== 'done' && !priorityIds.includes(t.id) && (!taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase())),
  );
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const projectName = (id: string | null) => data.projects.find(p => p.id === id)?.title ?? 'Personal';

  return (
    <div className="view-stack">
      <FilmHeader
        eyebrow={prettyDate(today)}
        title={greeting.toLowerCase()}
        subtitle="Choose what matters. Then do the work."
        scene={`daily overview · take ${today}`}
        onReview={onReview}
        onAddTask={onAddTask}
      />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-top"><span>Daily progress</span><Activity size={16} /></div>
          <div className="stat-value">{completion}<small>%</small></div>
          <Progress value={completion} />
          <div className="stat-foot">{doneHabits + completedToday} of {scheduledHabitsCount + todayTasks.length} actions completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Priority wins</span><Flag size={16} /></div>
          <div className="stat-value">{priorityTasks.filter(t => t.status === 'done').length}<small>/{priorityTasks.length}</small></div>
          <div className="stat-foot">Your three most important outcomes</div>
          <div className="stat-mini"><span style={{ width: `${priorityTasks.length ? (priorityTasks.filter(t => t.status === 'done').length / priorityTasks.length) * 100 : 0}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Active projects</span><FolderKanban size={16} /></div>
          <div className="stat-value">{data.projects.filter(p => p.status === 'active').length.toString().padStart(2, '0')}</div>
          <div className="stat-foot">{data.tasks.filter(t => t.status === 'todo').length} open tasks across your projects</div>
          <div className="stat-quiet"><span />Max {MAX_ACTIVE_PROJECTS} active for focus</div>
        </div>
      </div>

      <div className="today-columns">
        <section className="panel priorities-panel">
          <div className="panel-head">
            <div><div className="eyebrow">the essential</div><h2>Today&apos;s priorities</h2></div>
            <span className="count-pill">{priorityTasks.length}/3</span>
          </div>
          {priorityTasks.length ? (
            <div className="priority-list">
              {priorityTasks.map((task, index) => (
                <div className={cx('priority-row', task.status === 'done' && 'is-done')} key={task.id}>
                  <button
                    type="button"
                    aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    className={cx('check-control', task.status === 'done' && 'checked')}
                    onClick={() => onToggleTask(task)}
                  >
                    {task.status === 'done' && <Check size={14} />}
                  </button>
                  <span className="priority-number">0{index + 1}</span>
                  <button type="button" className="task-title-button" onClick={() => onEditTask(task.id)}>
                    <b>{task.title}</b>
                    <small>{projectName(task.projectId)} · {task.priority} priority</small>
                  </button>
                  <button
                    type="button"
                    className="icon-btn subtle"
                    title="Remove from today's priorities"
                    aria-label={`Remove ${task.title} from priorities`}
                    onClick={() => onPriorities(priorityIds.filter(id => id !== task.id))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="priority-empty">
              <Target size={21} />
              <p>Nothing is in your top three yet.</p>
              <span>Pick up to three tasks that would make today count.</span>
            </div>
          )}
          <div className="panel-foot">
            <Button variant="outline" onClick={() => setShowPriorityPicker(v => !v)}>
              <Plus size={15} />{showPriorityPicker ? 'Done selecting' : 'Set priorities'}
            </Button>
            <span>Limit yourself to three.</span>
          </div>
          {showPriorityPicker && (
            <div className="priority-picker">
              <div className="picker-top">
                <b>Choose your priorities</b>
                <span>{priorityIds.length}/3 selected</span>
              </div>
              <input className="search-input" placeholder="Find an open task..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
              {available.slice(0, 8).map(task => (
                <button
                  type="button"
                  className="picker-item"
                  key={task.id}
                  disabled={priorityIds.length >= 3}
                  onClick={() => onPriorities([...priorityIds, task.id])}
                >
                  <Plus size={14} />
                  <span>{task.title}</span>
                  <small>{projectName(task.projectId)}</small>
                </button>
              ))}
              {available.length === 0 && <div className="picker-empty">No matching open tasks available.</div>}
              {priorityIds.length > 0 && (
                <button type="button" className="clear-priorities" onClick={() => onPriorities([])}>
                  Clear today&apos;s priorities
                </button>
              )}
            </div>
          )}
        </section>

        <section className="panel habits-panel">
          <div className="panel-head">
            <div><div className="eyebrow">show up daily</div><h2>Habits</h2></div>
            <span className="count-pill">{doneHabits}/{scheduledHabitsCount}</span>
          </div>
          {activeHabits.length ? (
            <div className="habit-check-list">
              {activeHabits.map(habit => {
                const done = completedHabitIds.has(habit.id);
                const skipped = skippedHabitIds.has(habit.id);
                return (
                  <div key={habit.id} className={cx('habit-check-row-wrap', done && 'is-done', skipped && 'is-skipped')}>
                    <button
                      type="button"
                      onClick={() => onToggleHabit(habit)}
                      className={cx('habit-check-row', done && 'is-done')}
                      aria-pressed={done}
                    >
                      <span className={cx('habit-check', done && 'checked', skipped && 'skipped')}>
                        {done ? <Check size={13} /> : skipped ? '–' : null}
                      </span>
                      <span>{habit.name}</span>
                      <small>{done ? 'done' : skipped ? 'skipped' : 'open'}</small>
                    </button>
                    {!done && (
                      <button
                        type="button"
                        className={cx('habit-skip-btn', skipped && 'active')}
                        title={skipped ? 'Undo skip' : 'Skip for today without breaking streak'}
                        aria-label={skipped ? `Undo skip for ${habit.name}` : `Skip ${habit.name} today`}
                        onClick={() => onToggleSkipHabit(habit)}
                      >
                        {skipped ? 'Undo' : 'Skip'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="No scheduled habits today" body="Add repeatable actions or check your habit schedule in Habits." />
          )}
          <div className="habits-progress">
            <Progress value={scheduledHabitsCount ? (doneHabits / scheduledHabitsCount) * 100 : 0} />
            <span>{scheduledHabitsCount ? Math.round((doneHabits / scheduledHabitsCount) * 100) : 0}% complete</span>
          </div>
        </section>
      </div>

      <section className="panel tasks-panel">
        <div className="panel-head">
          <div><div className="eyebrow">make progress visible</div><h2>Today&apos;s tasks</h2></div>
          <Button variant="solid" onClick={onAddTask}><Plus size={15} /> Add task</Button>
        </div>
        {todayTasks.length ? (
          <div className="task-table">
            {todayTasks.map(task => (
              <div className={cx('task-row', task.status === 'done' && 'is-done')} key={task.id}>
                <button
                  type="button"
                  aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  className={cx('check-control', task.status === 'done' && 'checked')}
                  onClick={() => onToggleTask(task)}
                >
                  {task.status === 'done' && <Check size={14} />}
                </button>
                <button type="button" className="task-title-button" onClick={() => onEditTask(task.id)}>
                  <b>{task.title}</b>
                  <small>{projectName(task.projectId)}</small>
                </button>
                <span className={cx('priority-tag', task.priority)}>{task.priority}</span>
                <button type="button" className="icon-btn subtle" aria-label={`Edit ${task.title}`} onClick={() => onEditTask(task.id)}>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="A clear runway."
            body="Add a task with a date and make the next action obvious."
            action={<Button variant="outline" onClick={onAddTask}><Plus size={15} /> Create first task</Button>}
          />
        )}

        {overdueTasks.length > 0 && (
          <div className="overdue-block">
            <div className="overdue-head">
              <span className="eyebrow">overdue · carry forward or complete</span>
              <span className="overdue-count">{overdueTasks.length}</span>
            </div>
            {overdueTasks.slice(0, 6).map(task => (
              <div className="task-row overdue-row" key={task.id}>
                <button
                  type="button"
                  aria-label={`Complete overdue task ${task.title}`}
                  className="check-control"
                  onClick={() => onToggleTask(task)}
                />
                <button type="button" className="task-title-button" onClick={() => onEditTask(task.id)}>
                  <b>{task.title}</b>
                  <small>{projectName(task.projectId)} · due {shortDate(task.dueDate)}</small>
                </button>
                <button type="button" className="move-today-btn" onClick={() => onMoveToToday(task.id)}>
                  Move to today
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="today-bottom">
        <span><span className="status-dot" /> {completedToday} tasks completed today</span>
        <button type="button" onClick={onReview}>Reflect on today <ArrowUpRight size={14} /></button>
      </div>
    </div>
  );
}

function GoalsView({
  goals, lifeAreas, projects, tasks, onAdd, onEdit, onDelete,
}: {
  goals: Goal[]; lifeAreas: AppData['lifeAreas']; projects: Project[]; tasks: Task[];
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string, title: string) => void;
}) {
  const active = goals.filter(g => g.status === 'active');
  const inactive = goals.filter(g => g.status !== 'active');

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="direction · outcomes" title="Goals">
        <Button variant="solid" onClick={onAdd}><Plus size={15} /> New goal</Button>
      </SectionTitle>
      <div className="page-lede">A goal defines the result. Projects and tasks define the work that gets you there.</div>

      {active.length ? (
        <div className="goal-grid">
          {active.map(goal => {
            const metrics = getGoalProgress(goal, projects, tasks);
            const lifeArea = lifeAreas.find(area => area.id === goal.lifeAreaId);
            return (
              <article className="goal-card" key={goal.id}>
                <div className="card-topline">
                  <span className="tag-label">{lifeArea?.name ?? 'UNASSIGNED AREA'}</span>
                  <div className="project-actions">
                    <button type="button" className="icon-btn" title="Edit goal" aria-label={`Edit goal ${goal.title}`} onClick={() => onEdit(goal.id)}>
                      <Settings2 size={15} />
                    </button>
                    <button type="button" className="icon-btn" title="Delete goal" aria-label={`Delete goal ${goal.title}`} onClick={() => onDelete(goal.id, goal.title)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <h3>{goal.title}</h3>
                <p>{goal.outcome || 'Define what success looks like.'}</p>
                <div className="goal-date"><CalendarDays size={14} /> Target · {goal.targetDate ? shortDate(goal.targetDate) : 'No deadline'}</div>
                <div className="goal-progress-head">
                  <span>Execution progress</span>
                  <b>{metrics.percent}%</b>
                </div>
                <Progress value={metrics.percent} />
                <div className="goal-card-foot">
                  <span>
                    {metrics.linkedProjects} projects · {metrics.completedTasks}/{metrics.totalTasks} tasks done
                  </span>
                  <button type="button" onClick={() => onEdit(goal.id)}>Edit goal <ArrowUpRight size={13} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Give your effort a direction."
          body="Create one meaningful outcome. You can connect projects and tasks to it as you go."
          action={<Button variant="solid" onClick={onAdd}><Plus size={15} /> Create a goal</Button>}
        />
      )}

      {inactive.length > 0 && (
        <div className="archive-list">
          <div className="eyebrow">completed / archived</div>
          {inactive.map(g => (
            <div key={g.id} className="archive-row">
              <CheckCircle2 size={15} />
              <span>{g.title}</span>
              <small className="archive-status">{g.status}</small>
              <button type="button" onClick={() => onEdit(g.id)}>Edit</button>
              <button type="button" aria-label={`Delete ${g.title}`} onClick={() => onDelete(g.id, g.title)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectsView({
  projects, goals, tasks, onAdd, onEdit, onDelete, onAddTask, onToggleTask, onEditTask,
}: {
  projects: Project[]; goals: Goal[]; tasks: Task[];
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string, title: string) => void;
  onAddTask: (id: string) => void; onToggleTask: (t: Task) => void; onEditTask: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const visible = projects.filter(p => filter === 'all' || p.status === 'active');
  const activeCount = projects.filter(p => p.status === 'active').length;
  const neglectedMap = new Map(getNeglectedProjects(projects, tasks).map(n => [n.project.id, n]));

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="strategy · deliverables" title="Projects">
        <div className="project-title-actions">
          <span className="active-project-count">{activeCount}/{MAX_ACTIVE_PROJECTS} active</span>
          <Button variant="solid" onClick={onAdd}><Plus size={15} /> New project</Button>
        </div>
      </SectionTitle>
      <div className="page-toolbar">
        <p className="page-lede">Projects turn goals into milestones you can actually complete. Limit active work to {MAX_ACTIVE_PROJECTS}.</p>
        <div className="segmented">
          <button type="button" className={filter === 'active' ? 'selected' : ''} onClick={() => setFilter('active')}>Active</button>
          <button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>

      {visible.length ? (
        <div className="project-list">
          {visible.map(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id && t.status !== 'skipped');
            const done = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
            const goal = goals.find(g => g.id === project.goalId);
            const neglected = neglectedMap.get(project.id);
            const isExpanded = expandedProjectId === project.id;

            return (
              <article className="project-card" key={project.id}>
                <div className="project-main">
                  <div className="project-symbol"><FolderKanban size={18} /></div>
                  <div className="project-copy">
                    <div className="project-meta">
                      <span className={cx('status-label', project.status)}>{project.status}</span>
                      {goal && <span>↗ {goal.title}</span>}
                      {neglected && (
                        <span className="attention-tag">
                          {neglected.reason === 'no-tasks' ? 'No tasks yet' : `Quiet ${neglected.daysIdle}d`}
                        </span>
                      )}
                    </div>
                    <h3>{project.title}</h3>
                    <p>{project.description || 'No project description yet.'}</p>
                  </div>
                  <div className="project-actions">
                    <button type="button" className="icon-btn" aria-label={`Edit project ${project.title}`} onClick={() => onEdit(project.id)}>
                      <Settings2 size={16} />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Delete project ${project.title}`} onClick={() => onDelete(project.id, project.title)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="project-progress">
                  <div><span>{done} of {projectTasks.length} tasks completed</span><b>{progress}%</b></div>
                  <Progress value={progress} />
                </div>

                <div className="project-foot">
                  <span><CalendarDays size={13} /> {project.dueDate ? `Due ${shortDate(project.dueDate)}` : 'No deadline'}</span>
                  <div className="project-foot-actions">
                    <button
                      type="button"
                      onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                    >
                      {isExpanded ? 'Hide tasks' : `Tasks (${projectTasks.length})`}
                    </button>
                    <button type="button" onClick={() => onAddTask(project.id)}><Plus size={14} /> Add task</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="project-task-drawer">
                    {projectTasks.length ? (
                      projectTasks.map(task => (
                        <div className={cx('task-row', task.status === 'done' && 'is-done')} key={task.id}>
                          <button
                            type="button"
                            aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                            className={cx('check-control', task.status === 'done' && 'checked')}
                            onClick={() => onToggleTask(task)}
                          >
                            {task.status === 'done' && <Check size={14} />}
                          </button>
                          <button type="button" className="task-title-button" onClick={() => onEditTask(task.id)}>
                            <b>{task.title}</b>
                            <small>{task.dueDate ? `Due ${shortDate(task.dueDate)}` : 'No date'} · {task.priority}</small>
                          </button>
                          <button type="button" className="icon-btn subtle" aria-label={`Edit ${task.title}`} onClick={() => onEditTask(task.id)}>
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="project-drawer-empty">No tasks linked yet. Add a concrete next action.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Start with a project."
          body="Give a goal a concrete shape. A project should have a finish line."
          action={<Button variant="solid" onClick={onAdd}><Plus size={15} /> Create a project</Button>}
        />
      )}
    </div>
  );
}

function HabitsView({
  habits, logs, completedHabitIds, today, onAdd, onEdit, onDelete, onToggle,
}: {
  habits: Habit[]; logs: AppData['habitLogs']; completedHabitIds: Set<string>; today: string;
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string, title: string) => void;
  onToggle: (h: Habit, date: string) => void;
}) {
  const now = new Date(`${today}T12:00:00`);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLogs = logs.filter(l => l.date.startsWith(monthPrefix) && l.status === 'done');
  const monthLogStatusMap = new Map(logs.filter(l => l.date.startsWith(monthPrefix)).map(log => [`${log.habitId}:${log.date}`, log.status]));

  const activeHabitsList = habits.filter(h => h.active);
  const completedToday = activeHabitsList.filter(habit => completedHabitIds.has(habit.id)).length;
  const consistency30d = activeHabitsList.length
    ? Math.round(activeHabitsList.reduce((sum, h) => sum + getHabitConsistency(h, logs, 30, now).rate, 0) / activeHabitsList.length)
    : 0;

  const moveMonth = (direction: number) => {
    const d = new Date(year, month + direction, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="consistency · repeatable actions" title="Habits">
        <Button variant="solid" onClick={onAdd}><Plus size={15} /> New habit</Button>
      </SectionTitle>
      <div className="page-lede">Build a rhythm, not a perfect streak. Click cells to mark done, click again to mark skipped, or clear.</div>

      <div className="habit-summary">
        <div><span>Active habits</span><b>{activeHabitsList.length}</b></div>
        <div><span>30-day adherence</span><b>{consistency30d}%</b></div>
        <div><span>This month · Today</span><b>{monthLogs.length} · {completedToday}/{activeHabitsList.length}</b></div>
      </div>

      <section className="panel habit-matrix-panel">
        <div className="matrix-head">
          <div><div className="eyebrow">monthly view</div><h2>{monthName}</h2></div>
          <div className="matrix-nav">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setMonth(now.getMonth());
                setYear(now.getFullYear());
              }}
            >
              Today
            </button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
          </div>
        </div>

        {habits.length ? (
          <div className="matrix-scroll">
            <table className="habit-table">
              <thead>
                <tr>
                  <th className="habit-name-cell">Habit · Streak / 30d</th>
                  {Array.from({ length: days }, (_, i) => (
                    <th key={i} className={i + 1 === now.getDate() && month === now.getMonth() && year === now.getFullYear() ? 'today-col' : ''}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map(h => {
                  const streak = getStreak(h.id, logs, now);
                  const best = getBestStreak(h.id, logs);
                  const consistency = getHabitConsistency(h, logs, 30, now);
                  return (
                    <tr key={h.id}>
                      <td className="habit-name-cell">
                        <div className="habit-name">
                          <span className={cx('habit-active-dot', h.active && 'on')} />
                          <div className="habit-name-meta">
                            <button type="button" onClick={() => onEdit(h.id)}>{h.name}</button>
                            <small className="habit-submeta">
                              {h.frequency} · {streak}d (best {best}d) · {consistency.rate}%
                            </small>
                          </div>
                          <button type="button" className="delete-mini" aria-label={`Delete habit ${h.name}`} onClick={() => onDelete(h.id, h.name)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                      {Array.from({ length: days }, (_, i) => {
                        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                        const logStatus = monthLogStatusMap.get(`${h.id}:${date}`);
                        const future = date > today;
                        return (
                          <td key={i}>
                            <button
                              type="button"
                              disabled={future || !h.active}
                              aria-label={`${h.name} ${date}: ${logStatus ?? 'not completed'}`}
                              className={cx('matrix-cell', logStatus === 'done' && 'done', logStatus === 'skipped' && 'skipped', future && 'future')}
                              onClick={() => onToggle(h, date)}
                            >
                              {logStatus === 'done' ? <Check size={11} /> : logStatus === 'skipped' ? '–' : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No habits yet."
            body="Start with actions you can repeat consistently."
            action={<Button variant="outline" onClick={onAdd}><Plus size={15} /> Add a habit</Button>}
          />
        )}

        <div className="matrix-legend">
          <span><i className="legend-square done" /> Completed</span>
          <span><i className="legend-square skipped" /> Skipped</span>
          <span><i className="legend-square" /> Not completed</span>
          <span>Future dates are locked</span>
        </div>
      </section>
    </div>
  );
}

function ReviewView({ data, today, onWrite }: { data: AppData; today: string; onWrite: (date?: string) => void }) {
  const now = new Date(`${today}T12:00:00`);
  const summary = getWeeklyReflectionSummary(data, today, now);
  const recordedReviews = [...data.dailyReviews]
    .filter(r => Boolean(r.wins.trim() || r.blockers.trim() || r.notes.trim()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestReview = recordedReviews[0];

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="evidence · adjustment" title="Weekly review">
        <Button variant="solid" onClick={() => onWrite(today)}><Plus size={15} /> Write today&apos;s review</Button>
      </SectionTitle>
      <div className="page-lede">Look at the evidence. Keep what works. Change what doesn&apos;t.</div>

      <div className="review-metrics">
        <div className="review-metric">
          <span>Priorities executed</span>
          <b>{summary.priorityDone}<small>/{summary.priorityPlanned}</small></b>
          <Progress value={summary.priorityPlanned ? (summary.priorityDone / summary.priorityPlanned) * 100 : 0} />
          <small>{summary.tasksDone}/{summary.tasksTotal} scheduled tasks done this week</small>
        </div>
        <div className="review-metric">
          <span>Habit consistency</span>
          <b>{summary.habitRate}<small>%</small></b>
          <Progress value={summary.habitRate} />
          <small>{summary.habitDone} of {summary.habitScheduled} scheduled check-ins</small>
        </div>
        <div className="review-metric">
          <span>Projects moving</span>
          <b>{summary.advancingProjects.length}<small>/{data.projects.filter(p => p.status === 'active').length}</small></b>
          <small>
            {summary.neglectedProjects.length > 0
              ? `${summary.neglectedProjects.length} active project needs attention`
              : 'All active projects have recent work'}
          </small>
        </div>
        <div className="review-metric">
          <span>Unfinished · Reviews</span>
          <b>{summary.overdueCount}<small> overdue</small></b>
          <small>{summary.reviewsWritten}/7 days reflected this week</small>
        </div>
      </div>

      {(summary.advancingProjects.length > 0 || summary.neglectedProjects.length > 0) && (
        <section className="panel intelligence-panel">
          <div className="panel-head">
            <div><div className="eyebrow">execution evidence</div><h2>Where momentum went this week</h2></div>
          </div>
          <div className="intelligence-columns">
            <div>
              <span className="review-label">ADVANCING PROJECTS</span>
              {summary.advancingProjects.length ? (
                <ul className="intelligence-list">
                  {summary.advancingProjects.map(item => (
                    <li key={item.project.id}>
                      <b>{item.project.title}</b>
                      <small>{item.completedThisWeek} task{item.completedThisWeek === 1 ? '' : 's'} completed</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="intelligence-muted">No project tasks completed yet this week.</p>
              )}
            </div>
            <div>
              <span className="review-label">REQUIRING ATTENTION</span>
              {summary.neglectedProjects.length ? (
                <ul className="intelligence-list">
                  {summary.neglectedProjects.map(item => (
                    <li key={item.project.id}>
                      <b>{item.project.title}</b>
                      <small>{item.reason === 'no-tasks' ? 'No tasks defined yet' : `${item.daysIdle} days without activity`}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="intelligence-muted">Every active project has recent activity.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div><div className="eyebrow">your recent reflection</div><h2>Last review</h2></div>
          {latestReview && (
            <Button variant="outline" onClick={() => onWrite(latestReview.date)}>Edit</Button>
          )}
        </div>
        {latestReview ? (
          <div className="review-content">
            <div><span className="review-label">WINS</span><p>{latestReview.wins || 'No wins written down.'}</p></div>
            <div><span className="review-label">BLOCKERS</span><p>{latestReview.blockers || 'No blockers written down.'}</p></div>
            <div><span className="review-label">NEXT ADJUSTMENT</span><p>{latestReview.notes || 'No adjustment noted.'}</p></div>
            <div className="review-date">{prettyDate(latestReview.date)} · Energy {latestReview.energy}/5</div>
          </div>
        ) : (
          <Empty
            title="No reflection recorded yet."
            body="A five-minute review can reveal why your plans are or aren't working."
            action={<Button variant="outline" onClick={() => onWrite(today)}>Write your first review</Button>}
          />
        )}
      </section>

      {recordedReviews.length > 1 && (
        <section className="panel">
          <div className="panel-head">
            <div><div className="eyebrow">past reflections</div><h2>Review history</h2></div>
            <span className="count-pill">{recordedReviews.length}</span>
          </div>
          <div className="review-history-list">
            {recordedReviews.slice(1, 15).map(entry => (
              <div className="review-history-row" key={entry.date}>
                <div className="review-history-meta">
                  <b>{prettyDate(entry.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                  <span>Energy {entry.energy}/5</span>
                </div>
                <p>{entry.wins || entry.notes || entry.blockers}</p>
                <button type="button" className="text-action" onClick={() => onWrite(entry.date)}>Edit</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="review-prompt">
        <div className="review-prompt-icon"><Sparkles size={18} /></div>
        <div>
          <b>One honest question</b>
          <p>What is the smallest change that would make next week more executable?</p>
        </div>
        <Button variant="outline" onClick={() => onWrite(today)}>Reflect now <ArrowUpRight size={14} /></Button>
      </section>
    </div>
  );
}

function EditorModal({
  kind, id, reviewDate, today, data, activeProjectCount, newTaskProjectId, onClose, onCreateLifeArea, onDeleteItem, onSave,
}: {
  kind: 'task' | 'goal' | 'project' | 'habit' | 'review';
  id: string | null;
  reviewDate: string;
  today: string;
  data: AppData;
  activeProjectCount: number;
  newTaskProjectId: string | null;
  onClose: () => void;
  onCreateLifeArea: (name: string) => string;
  onDeleteItem: (kind: 'task' | 'goal' | 'project' | 'habit', id: string, title: string) => void;
  onSave: (kind: 'task' | 'goal' | 'project' | 'habit' | 'review', value: Task | Goal | Project | Habit | DailyReview) => void;
}) {
  const existingTask = data.tasks.find(x => x.id === id);
  const existingGoal = data.goals.find(x => x.id === id);
  const existingProject = data.projects.find(x => x.id === id);
  const existingHabit = data.habits.find(x => x.id === id);

  const [selectedReviewDate, setSelectedReviewDate] = useState(reviewDate || today);
  const existingReview = data.dailyReviews.find(x => x.date === selectedReviewDate);

  const [title, setTitle] = useState(existingTask?.title ?? existingGoal?.title ?? existingProject?.title ?? existingHabit?.name ?? '');
  const [description, setDescription] = useState(existingProject?.description ?? existingGoal?.outcome ?? '');
  const [dueDate, setDueDate] = useState(existingTask?.dueDate ?? existingProject?.dueDate ?? existingGoal?.targetDate ?? today);
  const [priority, setPriority] = useState<Priority>(existingTask?.priority ?? 'medium');
  const [projectId, setProjectId] = useState(existingTask?.projectId ?? newTaskProjectId ?? '');
  const [goalId, setGoalId] = useState(existingProject?.goalId ?? '');
  const [lifeAreaId, setLifeAreaId] = useState(existingGoal?.lifeAreaId ?? '');
  const [newAreaName, setNewAreaName] = useState('');
  const [addingArea, setAddingArea] = useState(false);
  const [status, setStatus] = useState(existingTask?.status ?? 'todo');
  const [goalStatus, setGoalStatus] = useState<Status>(existingGoal?.status ?? 'active');
  const [projectStatus, setProjectStatus] = useState<Project['status']>(existingProject?.status ?? 'active');
  const [formError, setFormError] = useState('');
  const [frequency, setFrequency] = useState<Habit['frequency']>(existingHabit?.frequency ?? 'daily');
  const [active, setActive] = useState(existingHabit?.active ?? true);
  const [wins, setWins] = useState(existingReview?.wins ?? '');
  const [blockers, setBlockers] = useState(existingReview?.blockers ?? '');
  const [notes, setNotes] = useState(existingReview?.notes ?? '');
  const [energy, setEnergy] = useState(existingReview?.energy ?? 3);

  const handleReviewDateChange = (nextDate: string) => {
    setSelectedReviewDate(nextDate);
    const match = data.dailyReviews.find(r => r.date === nextDate);
    setWins(match?.wins ?? '');
    setBlockers(match?.blockers ?? '');
    setNotes(match?.notes ?? '');
    setEnergy(match?.energy ?? 3);
    setFormError('');
  };

  const isReview = kind === 'review';
  const heading = isReview ? 'Daily review' : `${id ? 'Edit' : 'Create'} ${kind}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const now = new Date().toISOString();

    if (kind === 'review') {
      if (!wins.trim() && !blockers.trim() && !notes.trim()) {
        setFormError('Write at least one win, blocker, or adjustment before saving your review.');
        return;
      }
      onSave(kind, { date: selectedReviewDate, wins: wins.trim(), blockers: blockers.trim(), notes: notes.trim(), energy });
      return;
    }

    if (!title.trim()) {
      setFormError('Title cannot be empty.');
      return;
    }

    if (kind === 'project' && projectStatus === 'active' && !canActivateProject(data.projects, existingProject?.id)) {
      setFormError(`The ${MAX_ACTIVE_PROJECTS}-project focus limit is reached. Complete or archive a project first.`);
      return;
    }

    if (kind === 'task') {
      onSave(kind, {
        id: existingTask?.id ?? uid(),
        title: title.trim(),
        projectId: projectId || null,
        dueDate,
        priority,
        status,
        createdAt: existingTask?.createdAt ?? now,
        completedAt: status === 'done' ? existingTask?.completedAt ?? now : null,
      });
    }
    if (kind === 'goal') {
      onSave(kind, {
        id: existingGoal?.id ?? uid(),
        lifeAreaId: lifeAreaId || null,
        title: title.trim(),
        outcome: description.trim(),
        targetDate: dueDate,
        status: goalStatus,
        createdAt: existingGoal?.createdAt ?? now,
      });
    }
    if (kind === 'project') {
      onSave(kind, {
        id: existingProject?.id ?? uid(),
        title: title.trim(),
        description: description.trim(),
        dueDate,
        goalId: goalId || null,
        status: projectStatus,
        createdAt: existingProject?.createdAt ?? now,
      });
    }
    if (kind === 'habit') {
      onSave(kind, {
        id: existingHabit?.id ?? uid(),
        name: title.trim(),
        frequency,
        active,
        createdAt: existingHabit?.createdAt ?? now,
      });
    }
  };

  return (
    <Modal title={heading} onClose={onClose}>
      <form className="editor-form" onSubmit={submit}>
        {kind !== 'review' && (
          <Field label={kind === 'habit' ? 'Habit name' : 'Title'}>
            <input
              autoFocus
              required
              maxLength={100}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                kind === 'task'
                  ? 'What needs to get done?'
                  : kind === 'goal'
                    ? 'What outcome are you aiming for?'
                    : kind === 'project'
                      ? 'Name this project'
                      : 'e.g. Read for 20 minutes'
              }
            />
          </Field>
        )}

        {(kind === 'goal' || kind === 'project') && (
          <Field label={kind === 'goal' ? 'What does success look like?' : 'Description'}>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Make the outcome concrete..." />
          </Field>
        )}

        {kind === 'goal' && (
          <>
            <Field label="Life area">
              <div className="inline-select-row">
                <select value={lifeAreaId} onChange={e => setLifeAreaId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {data.lifeAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
                <button type="button" className="text-action" onClick={() => setAddingArea(v => !v)}>
                  {addingArea ? 'Cancel' : '+ Area'}
                </button>
              </div>
            </Field>
            {addingArea && (
              <div className="inline-create-area">
                <input
                  type="text"
                  maxLength={60}
                  value={newAreaName}
                  placeholder="New life area name"
                  onChange={e => setNewAreaName(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const createdId = onCreateLifeArea(newAreaName);
                    if (createdId) {
                      setLifeAreaId(createdId);
                      setNewAreaName('');
                      setAddingArea(false);
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            )}
            <Field label="Status">
              <select value={goalStatus} onChange={e => setGoalStatus(e.target.value as Status)}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </>
        )}

        {(kind === 'task' || kind === 'goal' || kind === 'project') && (
          <Field label={kind === 'goal' ? 'Target date' : 'Due date'}>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
        )}

        {kind === 'task' && (
          <>
            <Field label="Project">
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Personal / unassigned</option>
                {data.projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
                <option value="todo">To do</option>
                <option value="done">Completed</option>
                <option value="skipped">Skipped</option>
              </select>
            </Field>
          </>
        )}

        {kind === 'project' && (
          <>
            <Field label="Connect to a goal">
              <select value={goalId} onChange={e => setGoalId(e.target.value)}>
                <option value="">No linked goal</option>
                {data.goals.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={projectStatus}
                onChange={e => {
                  setProjectStatus(e.target.value as Project['status']);
                  setFormError('');
                }}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            {activeProjectCount >= MAX_ACTIVE_PROJECTS && projectStatus === 'active' && existingProject?.status !== 'active' && (
              <p className="form-error" role="status">
                {MAX_ACTIVE_PROJECTS} active projects max. Complete or archive one to activate this project.
              </p>
            )}
          </>
        )}

        {kind === 'habit' && (
          <>
            <Field label="Frequency">
              <select value={frequency} onChange={e => setFrequency(e.target.value as Habit['frequency'])}>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
              </select>
            </Field>
            <label className="toggle-field">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active habit
            </label>
          </>
        )}

        {kind === 'review' && (
          <>
            <div className="review-form-intro">
              <Field label="Review date">
                <input type="date" max={today} value={selectedReviewDate} onChange={e => handleReviewDateChange(e.target.value)} />
              </Field>
              <p>Be honest, not impressive. This is information, not a performance review.</p>
            </div>
            <Field label="What went well?">
              <textarea rows={3} value={wins} onChange={e => setWins(e.target.value)} placeholder="What did you actually move forward?" />
            </Field>
            <Field label="What got in the way?">
              <textarea rows={3} value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Where did reality differ from the plan?" />
            </Field>
            <Field label="What will you adjust tomorrow?">
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="One concrete adjustment..." />
            </Field>
            <Field label={`Energy level · ${energy}/5`}>
              <input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(Number(e.target.value))} />
            </Field>
          </>
        )}

        {formError && <p className="form-error" role="alert">{formError}</p>}

        <div className="modal-actions">
          {id && kind !== 'review' && (
            <Button
              variant="danger"
              className="modal-delete-left"
              onClick={() => onDeleteItem(kind, id, title || 'this item')}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="solid" type="submit">
            <Check size={15} /> Save {kind === 'review' ? 'review' : kind}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
