import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, Archive, ArrowDown, ArrowUp, ArrowUpRight, BarChart3, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3,
  Download, Flag, FolderKanban, LayoutDashboard, ListTodo, Plus, Search,
  Settings2, Sparkles, Target, Trash2, Upload, X, Zap,
} from 'lucide-react';
import type { AppData, DailyReview, Goal, Habit, Priority, Project, Task } from './types';
import { createId, exportData, importData } from './services/appStore';
import { useHabits } from './context/HabitContext';
import { FilmHeader } from './components/FilmHeader';
import { InPursuitMark } from './components/InPursuitMark';
import { Overlay } from './components/Overlay';

type View = 'today' | 'goals' | 'projects' | 'habits' | 'review';
const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const prettyDate = (value: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', options);
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const uid = createId;
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');


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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{children}
  </div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Progress({ value, tone = 'lime' }: { value: number; tone?: 'lime' | 'blue' }) {
  return <div className="progress-track"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div>;
}

export default function App() {
  const { data, saveData, user, signOut, signIn } = useHabits();
  if (!data) return null;
  const [view, setView] = useState<View>('today');
  const [modal, setModal] = useState<'task' | 'goal' | 'project' | 'habit' | 'review' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const today = dateKey();
  const todayPlan = data?.dailyPlans?.find(p => p.date === today) ?? { date: today, priorityTaskIds: [] };
  const todayTasks = data.tasks.filter(t => t.dueDate === today && t.status !== 'skipped');
  const activeHabits = data.habits.filter(h => h.active && (h.frequency === 'daily' || (h.frequency === 'weekdays' && ![0,6].includes(new Date().getDay())) || (h.frequency === 'weekends' && [0,6].includes(new Date().getDay()))));
  const doneHabits = activeHabits.filter(h => data.habitLogs.some(l => l.habitId === h.id && l.date === today && l.status === 'done')).length;
  const completedToday = todayTasks.filter(t => t.status === 'done').length;
  const priorityTasks = todayPlan.priorityTaskIds.map(id => data.tasks.find(t => t.id === id)).filter((t): t is Task => !!t && t.status !== 'skipped');
  const priorityDone = priorityTasks.filter(t => t.status === 'done').length;
  const allTasks = data.tasks.filter(t => t.status === 'todo');
  const activeGoals = data.goals.filter(g => g.status === 'active');
  const activeProjects = data.projects.filter(p => p.status === 'active');
  const completion = activeHabits.length + todayTasks.length === 0 ? 0 : Math.round(((doneHabits + completedToday) / (activeHabits.length + todayTasks.length)) * 100);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const update = (fn: (current: AppData) => AppData) => saveData(fn(data));
  const toggleHabitOnDate = (habit: Habit, date: string) => update(current => {
    if (date > today) return current;
    const existing = current.habitLogs.find(l => l.habitId === habit.id && l.date === date);
    return { ...current, habitLogs: existing
      ? current.habitLogs.filter(l => l.id !== existing.id)
      : [...current.habitLogs, { id: uid(), habitId: habit.id, date, status: 'done' }] };
  });
  const toggleHabit = (habit: Habit) => toggleHabitOnDate(habit, today);
  const toggleTask = (task: Task) => update(current => ({
    ...current, tasks: current.tasks.map(t => t.id === task.id
      ? { ...t, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() }
      : t),
  }));
  const setPriorities = (ids: string[]) => update(current => ({
    ...current,
    dailyPlans: [...current.dailyPlans.filter(p => p.date !== today), { date: today, priorityTaskIds: ids.slice(0, 3) }],
  }));
  const openModal = (kind: NonNullable<typeof modal>, id?: string) => { setEditingId(id ?? null); setModal(kind); };
  const closeModal = () => { setModal(null); setEditingId(null); };
  const remove = (kind: 'task' | 'goal' | 'project' | 'habit', id: string) => {
    if (!window.confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    update(current => {
      if (kind === 'task') return { ...current, tasks: current.tasks.filter(x => x.id !== id), dailyPlans: current.dailyPlans.map(p => ({ ...p, priorityTaskIds: p.priorityTaskIds.filter(x => x !== id) })) };
      if (kind === 'goal') return { ...current, goals: current.goals.filter(x => x.id !== id), projects: current.projects.map(p => p.goalId === id ? { ...p, goalId: null } : p) };
      if (kind === 'project') return { ...current, projects: current.projects.filter(x => x.id !== id), tasks: current.tasks.map(t => t.projectId === id ? { ...t, projectId: null } : t) };
      return { ...current, habits: current.habits.filter(x => x.id !== id), habitLogs: current.habitLogs.filter(x => x.habitId !== id) };
    });
    notify(`${kind[0].toUpperCase() + kind.slice(1)} deleted`);
  };
  const handleImport = async (file?: File) => {
    if (!file) return;
    try { const imported = await importData(file); saveData(imported); notify('Backup restored successfully'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Import failed'); }
    if (importRef.current) importRef.current.value = '';
  };

  const nav = [
    { id: 'today' as const, label: 'Today', icon: LayoutDashboard },
    { id: 'goals' as const, label: 'Goals', icon: Target, count: activeGoals.length },
    { id: 'projects' as const, label: 'Projects', icon: FolderKanban, count: activeProjects.length },
    { id: 'habits' as const, label: 'Habits', icon: Activity },
    { id: 'review' as const, label: 'Review', icon: BarChart3 },
  ];
  const currentTitle = nav.find(n => n.id === view)?.label ?? 'Today';

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setView('today'); }}><InPursuitMark className="brand-mark" /><span>In<span>Pursuit</span></span></a>
      <div className="side-label">workspace</div>
      <nav className="side-nav">{nav.map(item => <button key={item.id} onClick={() => setView(item.id)} className={cx('nav-item', view === item.id && 'active')}>
        <item.icon size={17}/><span>{item.label}</span>{item.count !== undefined && <small>{item.count}</small>}
      </button>)}</nav>
      <div className="sidebar-bottom">
        <div className="focus-card"><div className="focus-icon"><Zap size={15}/></div><div><strong>Make it happen.</strong><p>Small actions. Real evidence.</p></div></div>
        <div className="sidebar-actions">
          <button onClick={() => exportData(data)}><Download size={15}/> Export backup</button>
          <button onClick={() => importRef.current?.click()}><Upload size={15}/> Restore backup</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={e => handleImport(e.target.files?.[0])}/>
        </div>
        <div className="local-note">
          <span className="status-dot"/> {user ? `Signed in as ${user.email}` : 'Data stays on this device'}
          <button className="btn ml-2" onClick={user ? signOut : signIn}>{user ? 'Sign Out' : 'Sign In'}</button>
        </div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="mobile-brand"><InPursuitMark className="brand-mark" /><span>In<span>Pursuit</span></span></div>
        <div className="breadcrumbs">workspace <ChevronRight size={13}/> <strong>{currentTitle}</strong></div>
        <div className="topbar-right"><span className="date-chip"><CalendarDays size={14}/>{prettyDate(today, { day: 'numeric', month: 'short', year: 'numeric' })}</span><button className="avatar">R</button></div>
      </header>
      <FilmHeader />

      <div className="content-wrap">
        {view === 'today' && <TodayView data={data} today={today} todayTasks={todayTasks} activeHabits={activeHabits} doneHabits={doneHabits} priorityTasks={priorityTasks} priorityIds={todayPlan.priorityTaskIds} completion={completion} completedToday={completedToday} onToggleHabit={toggleHabit} onToggleTask={toggleTask} onPriorities={setPriorities} onAddTask={() => openModal('task')} onEditTask={id => openModal('task', id)} onReview={() => openModal('review')}/>}
        {view === 'goals' && <GoalsView goals={data.goals} projects={data.projects} onAdd={() => openModal('goal')} onEdit={id => openModal('goal', id)} onDelete={id => remove('goal', id)}/>}
        {view === 'projects' && <ProjectsView projects={data.projects} goals={data.goals} tasks={data.tasks} onAdd={() => openModal('project')} onEdit={id => openModal('project', id)} onDelete={id => remove('project', id)} onAddTask={id => { openModal('task'); setEditingId(null); window.sessionStorage.setItem('inpursuit.newTaskProject', id); }}/>}
        {view === 'habits' && <HabitsView habits={data.habits} logs={data.habitLogs} today={today} onAdd={() => openModal('habit')} onEdit={id => openModal('habit', id)} onDelete={id => remove('habit', id)} onToggle={toggleHabitOnDate}/>}
        {view === 'review' && <ReviewView data={data} today={today} onWrite={() => openModal('review')}/>}
      </div>
    </main>

    {modal && <EditorModal kind={modal} id={editingId} data={data} onClose={closeModal} onSave={(kind, value) => {
      update(current => {
        if (kind === 'task') { const item = value as Task; return { ...current, tasks: current.tasks.some(x => x.id === item.id) ? current.tasks.map(x => x.id === item.id ? item : x) : [...current.tasks, item] }; }
        if (kind === 'goal') { const item = value as Goal; return { ...current, goals: current.goals.some(x => x.id === item.id) ? current.goals.map(x => x.id === item.id ? item : x) : [...current.goals, item] }; }
        if (kind === 'project') { const item = value as Project; return { ...current, projects: current.projects.some(x => x.id === item.id) ? current.projects.map(x => x.id === item.id ? item : x) : [...current.projects, item] }; }
        if (kind === 'habit') { const item = value as Habit; return { ...current, habits: current.habits.some(x => x.id === item.id) ? current.habits.map(x => x.id === item.id ? item : x) : [...current.habits, item] }; }
        const item = value as DailyReview;
        return { ...current, dailyReviews: [...current.dailyReviews.filter(x => x.date !== item.date), item] };
      });
      closeModal(); notify('Saved');
    }}/>}
    {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
    <Overlay />
  </div>;
}

function TodayView({ data, today, todayTasks, activeHabits, doneHabits, priorityTasks, priorityIds, completion, completedToday, onToggleHabit, onToggleTask, onPriorities, onAddTask, onEditTask, onReview }: {
  data: AppData; today: string; todayTasks: Task[]; activeHabits: Habit[]; doneHabits: number; priorityTasks: Task[]; priorityIds: string[]; completion: number; completedToday: number;
  onToggleHabit: (h: Habit) => void; onToggleTask: (t: Task) => void; onPriorities: (ids: string[]) => void; onAddTask: () => void; onEditTask: (id: string) => void; onReview: () => void;
}) {
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const available = data?.tasks?.filter(t => t.status !== 'skipped' && t.status !== 'done' && !priorityIds.includes(t.id) && (!taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase())));
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const projectName = (id: string | null) => id ? data?.projects?.find(p => p.id === id)?.title ?? 'Personal' : 'Personal';
  return <div className="view-stack">
    <div className="today-intro"><div><div className="eyebrow">{prettyDate(today)}</div><h1>{greeting}<span className="muted">.</span></h1><p>Choose what matters. Then do the work.</p></div><button className="review-shortcut" onClick={onReview}><span className="review-icon"><BarChart3 size={17}/></span><span><b>Daily review</b><small>Close the loop</small></span><ArrowUpRight size={16}/></button></div>
    <div className="stat-grid">
      <div className="stat-card"><div className="stat-top"><span>Daily progress</span><Activity size={16}/></div><div className="stat-value">{completion}<small>%</small></div><Progress value={completion}/><div className="stat-foot">{doneHabits + completedToday} of {activeHabits.length + todayTasks.length} actions completed</div></div>
      <div className="stat-card"><div className="stat-top"><span>Priority wins</span><Flag size={16}/></div><div className="stat-value">{priorityTasks.filter(t => t.status === 'done').length}<small>/{priorityTasks.length}</small></div><div className="stat-foot">Your three most important outcomes</div><div className="stat-mini"><span style={{ width: `${priorityTasks.length ? priorityTasks.filter(t => t.status === 'done').length / priorityTasks.length * 100 : 0}%` }}/></div></div>
      <div className="stat-card"><div className="stat-top"><span>Active projects</span><FolderKanban size={16}/></div><div className="stat-value">{data.projects.filter(p => p.status === 'active').length.toString().padStart(2, '0')}</div><div className="stat-foot">{data.tasks.filter(t => t.status === 'todo').length} open tasks across your projects</div><div className="stat-quiet"><span/>Keep momentum visible</div></div>
    </div>
    <div className="today-columns">
      <section className="panel priorities-panel"><div className="panel-head"><div><div className="eyebrow">the essential</div><h2>Today's priorities</h2></div><span className="count-pill">{priorityTasks.length}/3</span></div>
        {priorityTasks.length ? <div className="priority-list">{priorityTasks.map((task, index) => <div className={cx('priority-row', task.status === 'done' && 'is-done')} key={task.id}><button className={cx('check-control', task.status === 'done' && 'checked')} onClick={() => onToggleTask(task)}>{task.status === 'done' && <Check size={14}/>}</button><span className="priority-number">0{index + 1}</span><button className="task-title-button" onClick={() => onEditTask(task.id)}><b>{task.title}</b><small>{projectName(task.projectId)} · {task.priority} priority</small></button><button className="icon-btn subtle" onClick={() => onEditTask(task.id)}><ArrowUpRight size={15}/></button></div>)}</div> : <div className="priority-empty"><Target size={21}/><p>Nothing is in your top three yet.</p><span>Pick up to three tasks that would make today count.</span></div>}
        <div className="panel-foot"><Button variant="outline" onClick={() => setShowPriorityPicker(v => !v)}><Plus size={15}/>{showPriorityPicker ? 'Done selecting' : 'Set priorities'}</Button><span>Limit yourself to three.</span></div>
        {showPriorityPicker && <div className="priority-picker"><div className="picker-top"><b>Choose your priorities</b><span>{priorityIds.length}/3 selected</span></div><input className="search-input" placeholder="Find an open task..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)}/>{available.slice(0, 8).map(task => <button className="picker-item" key={task.id} disabled={priorityIds.length >= 3} onClick={() => onPriorities([...priorityIds, task.id])}><Plus size={14}/><span>{task.title}</span><small>{projectName(task.projectId)}</small></button>)}{priorityIds.length > 0 && <button className="clear-priorities" onClick={() => onPriorities([])}>Clear today's priorities</button>}</div>}
      </section>
      <section className="panel habits-panel"><div className="panel-head"><div><div className="eyebrow">show up daily</div><h2>Habits</h2></div><span className="count-pill">{doneHabits}/{activeHabits.length}</span></div>
        {activeHabits.length ? <div className="habit-check-list">{activeHabits.map(habit => { const done = data.habitLogs.some(l => l.habitId === habit.id && l.date === today && l.status === 'done'); return <button key={habit.id} onClick={() => onToggleHabit(habit)} className={cx('habit-check-row', done && 'is-done')}><span className={cx('habit-check', done && 'checked')}>{done && <Check size={13}/>}</span><span>{habit.name}</span><small>{done ? 'done' : 'open'}</small></button>; })}</div> : <Empty title="No active habits" body="Add a few repeatable actions to your daily system."/>}
        <div className="habits-progress"><Progress value={activeHabits.length ? doneHabits / activeHabits.length * 100 : 0}/><span>{activeHabits.length ? Math.round(doneHabits / activeHabits.length * 100) : 0}% complete</span></div>
      </section>
    </div>
    <section className="panel tasks-panel"><div className="panel-head"><div><div className="eyebrow">make progress visible</div><h2>Today's tasks</h2></div><Button variant="solid" onClick={onAddTask}><Plus size={15}/> Add task</Button></div>
      {todayTasks.length ? <div className="task-table">{todayTasks.map(task => <div className={cx('task-row', task.status === 'done' && 'is-done')} key={task.id}><button className={cx('check-control', task.status === 'done' && 'checked')} onClick={() => onToggleTask(task)}>{task.status === 'done' && <Check size={14}/>}</button><button className="task-title-button" onClick={() => onEditTask(task.id)}><b>{task.title}</b><small>{projectName(task.projectId)}</small></button><span className={cx('priority-tag', task.priority)}>{task.priority}</span><button className="icon-btn subtle" onClick={() => onEditTask(task.id)}><ArrowUpRight size={15}/></button></div>)}</div> : <Empty title="A clear runway." body="Add a task with a date and make the next action obvious." action={<Button variant="outline" onClick={onAddTask}><Plus size={15}/> Create first task</Button>}/>}
    </section>
    <div className="today-bottom"><span><span className="status-dot"/> {completedToday} tasks completed today</span><button onClick={onReview}>Reflect on today <ArrowUpRight size={14}/></button></div>
  </div>;
}

function GoalsView({ goals, projects, onAdd, onEdit, onDelete }: { goals: Goal[]; projects: Project[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const active = goals.filter(g => g.status === 'active');
  return <div className="view-stack"><SectionTitle eyebrow="direction · outcomes" title="Goals"><Button variant="solid" onClick={onAdd}><Plus size={15}/> New goal</Button></SectionTitle><div className="page-lede">A goal defines the result. Projects and tasks define the work that gets you there.</div>
    {active.length ? <div className="goal-grid">{active.map(goal => { const linked = projects.filter(p => p.goalId === goal.id); const completed = linked.filter(p => p.status === 'completed').length; const progress = linked.length ? Math.round(completed / linked.length * 100) : 0; return <article className="goal-card" key={goal.id}><div className="card-topline"><span className="tag-label">ACTIVE GOAL</span><div className="project-actions"><button className="icon-btn" title="Edit goal" onClick={() => onEdit(goal.id)}><Settings2 size={15}/></button><button className="icon-btn" title="Delete goal" onClick={() => onDelete(goal.id)}><Trash2 size={15}/></button></div></div><h3>{goal.title}</h3><p>{goal.outcome || 'Define what success looks like.'}</p><div className="goal-date"><CalendarDays size={14}/> Target · {goal.targetDate ? shortDate(goal.targetDate) : 'No deadline'}</div><div className="goal-progress-head"><span>Linked project completion</span><b>{progress}%</b></div><Progress value={progress}/><div className="goal-card-foot"><span>{linked.length} linked projects</span><button onClick={() => onEdit(goal.id)}>Edit goal <ArrowUpRight size={13}/></button></div></article>; })}</div> : <Empty title="Give your effort a direction." body="Create one meaningful outcome. You can connect projects and tasks to it as you go." action={<Button variant="solid" onClick={onAdd}><Plus size={15}/> Create a goal</Button>}/>}
    {goals.some(g => g.status !== 'active') && <div className="archive-list"><div className="eyebrow">completed / archived</div>{goals.filter(g => g.status !== 'active').map(g => <div key={g.id} className="archive-row"><CheckCircle2 size={15}/><span>{g.title}</span><button onClick={() => onEdit(g.id)}>Edit</button></div>)}</div>}
  </div>;
}

function ProjectsView({ projects, goals, tasks, onAdd, onEdit, onDelete, onAddTask }: { projects: Project[]; goals: Goal[]; tasks: Task[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onAddTask: (id: string) => void }) {
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const visible = projects.filter(p => filter === 'all' || p.status === 'active');
  return <div className="view-stack"><SectionTitle eyebrow="strategy · deliverables" title="Projects"><Button variant="solid" onClick={onAdd}><Plus size={15}/> New project</Button></SectionTitle><div className="page-toolbar"><p className="page-lede">Projects turn goals into milestones you can actually complete.</p><div className="segmented"><button className={filter === 'active' ? 'selected' : ''} onClick={() => setFilter('active')}>Active</button><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button></div></div>
    {visible.length ? <div className="project-list">{visible.map(project => { const projectTasks = tasks.filter(t => t.projectId === project.id); const done = projectTasks.filter(t => t.status === 'done').length; const progress = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0; const goal = goals.find(g => g.id === project.goalId); return <article className="project-card" key={project.id}><div className="project-main"><div className="project-symbol"><FolderKanban size={18}/></div><div className="project-copy"><div className="project-meta"><span className={cx('status-label', project.status)}>{project.status}</span>{goal && <span>↗ {goal.title}</span>}</div><h3>{project.title}</h3><p>{project.description || 'No project description yet.'}</p></div><div className="project-actions"><button className="icon-btn" onClick={() => onEdit(project.id)}><Settings2 size={16}/></button><button className="icon-btn" onClick={() => onDelete(project.id)}><Trash2 size={15}/></button></div></div><div className="project-progress"><div><span>{done} of {projectTasks.length} tasks completed</span><b>{progress}%</b></div><Progress value={progress}/></div><div className="project-foot"><span><CalendarDays size={13}/> {project.dueDate ? `Due ${shortDate(project.dueDate)}` : 'No deadline'}</span><button onClick={() => onAddTask(project.id)}><Plus size={14}/> Add task</button></div></article>; })}</div> : <Empty title="Start with a project." body="Give a goal a concrete shape. A project should have a finish line." action={<Button variant="solid" onClick={onAdd}><Plus size={15}/> Create a project</Button>}/>}
  </div>;
}

function HabitsView({ habits, logs, today, onAdd, onEdit, onDelete, onToggle }: { habits: Habit[]; logs: AppData['habitLogs']; today: string; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onToggle: (h: Habit, date: string) => void }) {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthLogs = logs.filter(l => l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && l.status === 'done');
  const moveMonth = (direction: number) => { const d = new Date(year, month + direction, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); };
  return <div className="view-stack"><SectionTitle eyebrow="consistency · repeatable actions" title="Habits"><Button variant="solid" onClick={onAdd}><Plus size={15}/> New habit</Button></SectionTitle><div className="page-lede">Build a rhythm, not a perfect streak. Track what you actually do.</div>
    <div className="habit-summary"><div><span>Active habits</span><b>{habits.filter(h => h.active).length}</b></div><div><span>Completions this month</span><b>{monthLogs.length}</b></div><div><span>Today</span><b>{habits.filter(h => h.active && logs.some(l => l.habitId === h.id && l.date === today && l.status === 'done')).length}/{habits.filter(h => h.active).length}</b></div></div>
    <section className="panel habit-matrix-panel"><div className="matrix-head"><div><div className="eyebrow">monthly view</div><h2>{monthName}</h2></div><div className="matrix-nav"><button className="icon-btn" onClick={() => moveMonth(-1)}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={() => { setMonth(new Date().getMonth()); setYear(new Date().getFullYear()); }}>Today</button><button className="icon-btn" onClick={() => moveMonth(1)}><ChevronRight size={17}/></button></div></div>
      {habits.length ? <div className="matrix-scroll"><table className="habit-table"><thead><tr><th className="habit-name-cell">Habit</th>{Array.from({ length: days }, (_, i) => <th key={i} className={`${i + 1 === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? 'today-col' : ''}`}>{i + 1}</th>)}</tr></thead><tbody>{habits.map(h => <tr key={h.id}><td className="habit-name-cell"><div className="habit-name"><span className={cx('habit-active-dot', h.active && 'on')}/><button onClick={() => onEdit(h.id)}>{h.name}</button><button className="delete-mini" onClick={() => onDelete(h.id)}><Trash2 size={12}/></button></div></td>{Array.from({ length: days }, (_, i) => { const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`; const done = logs.some(l => l.habitId === h.id && l.date === date && l.status === 'done'); const future = date > today; return <td key={i}><button disabled={future || !h.active} aria-label={`${h.name} ${date}`} className={cx('matrix-cell', done && 'done', future && 'future')} onClick={() => onToggle(h, date)}>{done && <Check size={11}/>}</button></td>; })}</tr>)}</tbody></table></div> : <Empty title="No habits yet." body="Start with actions you can repeat consistently." action={<Button variant="outline" onClick={onAdd}><Plus size={15}/> Add a habit</Button>}/>}
      <div className="matrix-legend"><span><i className="legend-square done"/> Completed</span><span><i className="legend-square"/> Not completed</span><span>Future dates are locked</span></div>
    </section>
  </div>;
}

function ReviewView({ data, today, onWrite }: { data: AppData; today: string; onWrite: () => void }) {
  const thisWeek = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i); return dateKey(d); });
  const weekLogs = data.habitLogs.filter(l => thisWeek.includes(l.date) && l.date <= today && l.status === 'done');
  const weekTasks = data.tasks.filter(t => thisWeek.includes(t.dueDate) && t.dueDate <= today);
  const doneTasks = weekTasks.filter(t => t.status === 'done').length;
  const openProjects = data.projects.filter(p => p.status === 'active');
  const latestReview = data.dailyReviews.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const reviewDays = data.dailyReviews.filter(r => thisWeek.includes(r.date)).length;
  return <div className="view-stack"><SectionTitle eyebrow="evidence · adjustment" title="Weekly review"><Button variant="solid" onClick={onWrite}><Plus size={15}/> Write a review</Button></SectionTitle><div className="page-lede">Look at the evidence. Keep what works. Change what doesn't.</div>
    <div className="review-metrics"><div className="review-metric"><span>Tasks completed</span><b>{doneTasks}<small>/{weekTasks.length}</small></b><Progress value={weekTasks.length ? doneTasks / weekTasks.length * 100 : 0}/></div><div className="review-metric"><span>Habit check-ins</span><b>{weekLogs.length}</b><small>Completions this week</small></div><div className="review-metric"><span>Active projects</span><b>{openProjects.length}</b><small>In motion right now</small></div><div className="review-metric"><span>Reviews written</span><b>{reviewDays}<small>/7</small></b><small>Days reflected on</small></div></div>
    <section className="panel"><div className="panel-head"><div><div className="eyebrow">your recent reflection</div><h2>Last review</h2></div></div>{latestReview ? <div className="review-content"><div><span className="review-label">WINS</span><p>{latestReview.wins || 'No wins written down.'}</p></div><div><span className="review-label">BLOCKERS</span><p>{latestReview.blockers || 'No blockers written down.'}</p></div><div><span className="review-label">NEXT ADJUSTMENT</span><p>{latestReview.notes || 'No adjustment noted.'}</p></div><div className="review-date">{prettyDate(latestReview.date)}</div></div> : <Empty title="No reflection recorded yet." body="A five-minute review can reveal why your plans are or aren't working." action={<Button variant="outline" onClick={onWrite}>Write your first review</Button>}/>}</section>
    <section className="review-prompt"><div className="review-prompt-icon"><Sparkles size={18}/></div><div><b>One honest question</b><p>What is the smallest change that would make next week more executable?</p></div><Button variant="outline" onClick={onWrite}>Reflect now <ArrowUpRight size={14}/></Button></section>
  </div>;
}

function EditorModal({ kind, id, data, onClose, onSave }: { kind: 'task' | 'goal' | 'project' | 'habit' | 'review'; id: string | null; data: AppData; onClose: () => void; onSave: (kind: 'task' | 'goal' | 'project' | 'habit' | 'review', value: Task | Goal | Project | Habit | DailyReview) => void }) {
  const projectForNewTask = window.sessionStorage.getItem('inpursuit.newTaskProject');
  useEffect(() => { if (kind === 'task') window.sessionStorage.removeItem('inpursuit.newTaskProject'); }, [kind]);
  const existingTask = data.tasks.find(x => x.id === id);
  const existingGoal = data.goals.find(x => x.id === id);
  const existingProject = data.projects.find(x => x.id === id);
  const existingHabit = data.habits.find(x => x.id === id);
  const existingReview = data.dailyReviews.find(x => x.date === dateKey());
  const [title, setTitle] = useState(existingTask?.title ?? existingGoal?.title ?? existingProject?.title ?? existingHabit?.name ?? '');
  const [description, setDescription] = useState(existingProject?.description ?? existingGoal?.outcome ?? '');
  const [dueDate, setDueDate] = useState(existingTask?.dueDate ?? existingProject?.dueDate ?? existingGoal?.targetDate ?? dateKey());
  const [priority, setPriority] = useState<Priority>(existingTask?.priority ?? 'medium');
  const [projectId, setProjectId] = useState(existingTask?.projectId ?? projectForNewTask ?? '');
  const [goalId, setGoalId] = useState(existingProject?.goalId ?? '');
  const [status, setStatus] = useState(existingTask?.status ?? 'todo');
  const [frequency, setFrequency] = useState<Habit['frequency']>(existingHabit?.frequency ?? 'daily');
  const [active, setActive] = useState(existingHabit?.active ?? true);
  const [wins, setWins] = useState(existingReview?.wins ?? '');
  const [blockers, setBlockers] = useState(existingReview?.blockers ?? '');
  const [notes, setNotes] = useState(existingReview?.notes ?? '');
  const [energy, setEnergy] = useState(existingReview?.energy ?? 3);
  const isReview = kind === 'review';
  const heading = isReview ? 'Daily review' : `${id ? 'Edit' : 'Create'} ${kind}`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    if (kind === 'review') { onSave(kind, { date: dateKey(), wins, blockers, notes, energy }); return; }
    if (!title.trim()) return;
    if (kind === 'task') onSave(kind, { id: existingTask?.id ?? uid(), title: title.trim(), projectId: projectId || null, dueDate, priority, status, createdAt: existingTask?.createdAt ?? now, completedAt: status === 'done' ? existingTask?.completedAt ?? now : null });
    if (kind === 'goal') onSave(kind, { id: existingGoal?.id ?? uid(), title: title.trim(), outcome: description.trim(), targetDate: dueDate, status: existingGoal?.status ?? 'active', createdAt: existingGoal?.createdAt ?? now });
    if (kind === 'project') onSave(kind, { id: existingProject?.id ?? uid(), title: title.trim(), description: description.trim(), dueDate, goalId: goalId || null, status: existingProject?.status ?? 'active', createdAt: existingProject?.createdAt ?? now });
    if (kind === 'habit') onSave(kind, { id: existingHabit?.id ?? uid(), name: title.trim(), frequency, active, createdAt: existingHabit?.createdAt ?? now });
  };
  return <Modal title={heading} onClose={onClose}><form className="editor-form" onSubmit={submit}>
    {kind !== 'review' && <Field label={kind === 'habit' ? 'Habit name' : 'Title'}><input autoFocus required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'task' ? 'What needs to get done?' : kind === 'goal' ? 'What outcome are you aiming for?' : kind === 'project' ? 'Name this project' : 'e.g. Read for 20 minutes'}/></Field>}
    {(kind === 'goal' || kind === 'project') && <Field label={kind === 'goal' ? 'What does success look like?' : 'Description'}><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Make the outcome concrete..."/></Field>}
    {(kind === 'task' || kind === 'goal' || kind === 'project') && <Field label={kind === 'goal' ? 'Target date' : 'Due date'}><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></Field>}
    {kind === 'task' && <><Field label="Project"><select value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Personal / unassigned</option>{data.projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field><Field label="Priority"><select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field><Field label="Status"><select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="todo">To do</option><option value="done">Completed</option><option value="skipped">Skipped</option></select></Field></>}
    {kind === 'project' && <Field label="Connect to a goal"><select value={goalId} onChange={e => setGoalId(e.target.value)}><option value="">No linked goal</option>{data.goals.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>}
    {kind === 'habit' && <><Field label="Frequency"><select value={frequency} onChange={e => setFrequency(e.target.value as Habit['frequency'])}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option></select></Field><label className="toggle-field"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/> Active habit</label></>}
    {kind === 'review' && <><div className="review-form-intro"><span className="eyebrow">{prettyDate(dateKey())}</span><p>Be honest, not impressive. This is information, not a performance review.</p></div><Field label="What went well?"><textarea rows={3} value={wins} onChange={e => setWins(e.target.value)} placeholder="What did you actually move forward?"/></Field><Field label="What got in the way?"><textarea rows={3} value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Where did reality differ from the plan?"/></Field><Field label="What will you adjust tomorrow?"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="One concrete adjustment..."/></Field><Field label={`Energy level · ${energy}/5`}><input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(Number(e.target.value))}/></Field></>}
    <div className="modal-actions"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="solid" type="submit"><Check size={15}/> Save {kind === 'review' ? 'review' : kind}</Button></div>
  </form></Modal>;
}
