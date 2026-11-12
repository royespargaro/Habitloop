import { useEffect, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Sparkles, X } from './Icon';
import type { AppData, BrainDumpPreview, Habit, Priority } from '../types';

type BrainDumpModalProps = {
  existingData?: AppData;
  onClose: () => void;
  onImport: (items: BrainDumpPreview) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const hasStringFields = (value: unknown, fields: string[]) => isRecord(value) && fields.every(field => typeof value[field] === 'string');

export function isBrainDumpPreview(value: unknown): value is BrainDumpPreview {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.lifeAreas) &&
    value.lifeAreas.every(item => hasStringFields(item, ['name', 'description'])) &&
    Array.isArray(value.goals) &&
    value.goals.every(item => hasStringFields(item, ['title', 'outcome', 'lifeAreaName', 'targetDate'])) &&
    Array.isArray(value.projects) &&
    value.projects.every(item => hasStringFields(item, ['title', 'description', 'goalTitle', 'dueDate'])) &&
    Array.isArray(value.habits) &&
    value.habits.every(item => hasStringFields(item, ['name', 'frequency'])) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(item => hasStringFields(item, ['title', 'projectTitle', 'dueDate', 'priority']))
  );
}

const keyOf = (s: string) => s.trim().toLocaleLowerCase();

export const BrainDumpModal = ({ existingData, onClose, onImport }: BrainDumpModalProps) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<BrainDumpPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const existingAreaNames = new Set((existingData?.lifeAreas ?? []).map(a => keyOf(a.name)));
  const existingGoalTitles = new Set((existingData?.goals ?? []).map(g => keyOf(g.title)));
  const existingProjectTitles = new Set((existingData?.projects ?? []).map(p => keyOf(p.title)));
  const existingHabitNames = new Set((existingData?.habits ?? []).map(h => keyOf(h.name)));
  const existingTaskTitles = new Set((existingData?.tasks ?? []).map(t => keyOf(t.title)));

  const isDuplicate = (section: keyof BrainDumpPreview, title: string): boolean => {
    const k = keyOf(title);
    if (!k) return false;
    if (section === 'lifeAreas') return existingAreaNames.has(k);
    if (section === 'goals') return existingGoalTitles.has(k);
    if (section === 'projects') return existingProjectTitles.has(k);
    if (section === 'habits') return existingHabitNames.has(k);
    return existingTaskTitles.has(k);
  };

  const analyze = async () => {
    setError('');
    setBusy(true);
    setEditingKey(null);
    try {
      const response = await fetch('/api/brain-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(body);
      } catch {
        throw new Error('The AI service returned an unreadable response. Please try again.');
      }
      if (!response.ok) {
        const message = isRecord(result) && typeof result.error === 'string' ? result.error : 'Could not analyze this draft.';
        throw new Error(message);
      }
      if (!isBrainDumpPreview(result)) {
        throw new Error('The AI response had an unexpected structure. Please try again.');
      }

      setPreview(result);
      const initialSelected = new Set<string>();
      result.lifeAreas.forEach((item, index) => {
        if (!isDuplicate('lifeAreas', item.name)) initialSelected.add(`lifeAreas:${index}`);
      });
      result.goals.forEach((item, index) => {
        if (!isDuplicate('goals', item.title)) initialSelected.add(`goals:${index}`);
      });
      result.projects.forEach((item, index) => {
        if (!isDuplicate('projects', item.title)) initialSelected.add(`projects:${index}`);
      });
      result.habits.forEach((item, index) => {
        if (!isDuplicate('habits', item.name)) initialSelected.add(`habits:${index}`);
      });
      result.tasks.forEach((item, index) => {
        if (!isDuplicate('tasks', item.title)) initialSelected.add(`tasks:${index}`);
      });
      setSelected(initialSelected);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the AI service.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allKeys = preview
    ? [
        ...preview.lifeAreas.map((_, i) => `lifeAreas:${i}`),
        ...preview.goals.map((_, i) => `goals:${i}`),
        ...preview.projects.map((_, i) => `projects:${i}`),
        ...preview.habits.map((_, i) => `habits:${i}`),
        ...preview.tasks.map((_, i) => `tasks:${i}`),
      ]
    : [];

  const toggleAll = () => {
    if (!preview) return;
    if (selected.size === allKeys.length) setSelected(new Set());
    else setSelected(new Set(allKeys));
  };

  const updateItem = <K extends keyof BrainDumpPreview>(
    section: K,
    index: number,
    patch: Partial<BrainDumpPreview[K][number]>,
  ) => {
    setPreview(current => {
      if (!current) return current;
      const copy = [...current[section]] as BrainDumpPreview[K];
      copy[index] = { ...copy[index], ...patch };
      return { ...current, [section]: copy };
    });
  };

  const importSelected = () => {
    if (!preview) return;
    onImport({
      lifeAreas: preview.lifeAreas.filter((item, index) => selected.has(`lifeAreas:${index}`) && item.name.trim()),
      goals: preview.goals.filter((item, index) => selected.has(`goals:${index}`) && item.title.trim()),
      projects: preview.projects.filter((item, index) => selected.has(`projects:${index}`) && item.title.trim()),
      habits: preview.habits.filter((item, index) => selected.has(`habits:${index}`) && item.name.trim()),
      tasks: preview.tasks.filter((item, index) => selected.has(`tasks:${index}`) && item.title.trim()),
    });
    onClose();
  };

  const totalCount = allKeys.length;

  return (
    <div className="modal-backdrop brain-dump-backdrop" onMouseDown={onClose}>
      <section
        className="modal brain-dump-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brain-dump-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <div className="eyebrow">AI · review before import</div>
            <h2 id="brain-dump-title">Brain dump</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close brain dump" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="brain-dump-privacy">
          <Sparkles size={16} />
          <p>
            Your draft is sent to Google Gemini for parsing. Review or edit every suggestion before importing; do not include passwords or sensitive credentials.
          </p>
        </div>

        {!preview ? (
          <div className="brain-dump-compose">
            <label className="field">
              <span>Raw notes</span>
              <textarea
                autoFocus
                maxLength={16000}
                rows={8}
                value={text}
                onChange={event => setText(event.target.value)}
                placeholder="Paste plans, meeting notes, or a life blueprint. InPursuit will suggest life areas, goals, projects, habits, and next actions."
              />
            </label>
            <div className="brain-dump-count">{text.length.toLocaleString()} / 16,000</div>
          </div>
        ) : (
          <div className="brain-dump-preview">
            <div className="brain-dump-preview-head">
              <div>
                <div className="eyebrow">suggested structure</div>
                <p>
                  {selected.size} selected · {totalCount} found
                </p>
              </div>
              <div className="brain-dump-preview-tools">
                {totalCount > 0 && (
                  <button className="text-action" type="button" onClick={toggleAll}>
                    {selected.size === totalCount ? 'Clear all' : 'Select all'}
                  </button>
                )}
                <button className="text-action" type="button" onClick={() => setPreview(null)}>
                  Edit draft
                </button>
              </div>
            </div>

            {totalCount === 0 ? (
              <div className="brain-dump-empty">
                No structured items found. Edit the draft and try again with more specific details.
              </div>
            ) : (
              <>
                {preview.lifeAreas.length > 0 && (
                  <section className="brain-dump-section">
                    <h3>
                      Life areas<span>{preview.lifeAreas.length}</span>
                    </h3>
                    {preview.lifeAreas.map((item, index) => {
                      const key = `lifeAreas:${index}`;
                      const duplicate = isDuplicate('lifeAreas', item.name);
                      const isEditing = editingKey === key;
                      return (
                        <div className="brain-dump-item-wrap" key={key}>
                          <label className="brain-dump-item">
                            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                            <span>
                              <b>
                                {item.name}
                                {duplicate && <em className="dup-badge">Already exists</em>}
                              </b>
                              {item.description && <small>{item.description}</small>}
                            </span>
                            <button
                              type="button"
                              className="brain-dump-edit-btn"
                              onClick={e => {
                                e.preventDefault();
                                setEditingKey(isEditing ? null : key);
                              }}
                            >
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </label>
                          {isEditing && (
                            <div className="brain-dump-inline-edit">
                              <input
                                type="text"
                                maxLength={80}
                                value={item.name}
                                aria-label="Life area name"
                                onChange={e => updateItem('lifeAreas', index, { name: e.target.value })}
                              />
                              <input
                                type="text"
                                maxLength={240}
                                value={item.description}
                                aria-label="Life area description"
                                placeholder="Description"
                                onChange={e => updateItem('lifeAreas', index, { description: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                {preview.goals.length > 0 && (
                  <section className="brain-dump-section">
                    <h3>
                      Goals<span>{preview.goals.length}</span>
                    </h3>
                    {preview.goals.map((item, index) => {
                      const key = `goals:${index}`;
                      const duplicate = isDuplicate('goals', item.title);
                      const isEditing = editingKey === key;
                      const detail = [item.lifeAreaName, item.outcome, item.targetDate].filter(Boolean).join(' · ');
                      return (
                        <div className="brain-dump-item-wrap" key={key}>
                          <label className="brain-dump-item">
                            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                            <span>
                              <b>
                                {item.title}
                                {duplicate && <em className="dup-badge">Already exists</em>}
                              </b>
                              {detail && <small>{detail}</small>}
                            </span>
                            <button
                              type="button"
                              className="brain-dump-edit-btn"
                              onClick={e => {
                                e.preventDefault();
                                setEditingKey(isEditing ? null : key);
                              }}
                            >
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </label>
                          {isEditing && (
                            <div className="brain-dump-inline-edit">
                              <input
                                type="text"
                                maxLength={120}
                                value={item.title}
                                aria-label="Goal title"
                                onChange={e => updateItem('goals', index, { title: e.target.value })}
                              />
                              <input
                                type="date"
                                value={item.targetDate}
                                aria-label="Goal target date"
                                onChange={e => updateItem('goals', index, { targetDate: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                {preview.projects.length > 0 && (
                  <section className="brain-dump-section">
                    <h3>
                      Projects<span>{preview.projects.length}</span>
                    </h3>
                    {preview.projects.map((item, index) => {
                      const key = `projects:${index}`;
                      const duplicate = isDuplicate('projects', item.title);
                      const isEditing = editingKey === key;
                      const detail = [item.goalTitle, item.description, item.dueDate].filter(Boolean).join(' · ');
                      return (
                        <div className="brain-dump-item-wrap" key={key}>
                          <label className="brain-dump-item">
                            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                            <span>
                              <b>
                                {item.title}
                                {duplicate && <em className="dup-badge">Already exists</em>}
                              </b>
                              {detail && <small>{detail}</small>}
                            </span>
                            <button
                              type="button"
                              className="brain-dump-edit-btn"
                              onClick={e => {
                                e.preventDefault();
                                setEditingKey(isEditing ? null : key);
                              }}
                            >
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </label>
                          {isEditing && (
                            <div className="brain-dump-inline-edit">
                              <input
                                type="text"
                                maxLength={120}
                                value={item.title}
                                aria-label="Project title"
                                onChange={e => updateItem('projects', index, { title: e.target.value })}
                              />
                              <input
                                type="date"
                                value={item.dueDate}
                                aria-label="Project due date"
                                onChange={e => updateItem('projects', index, { dueDate: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                {preview.habits.length > 0 && (
                  <section className="brain-dump-section">
                    <h3>
                      Habits<span>{preview.habits.length}</span>
                    </h3>
                    {preview.habits.map((item, index) => {
                      const key = `habits:${index}`;
                      const duplicate = isDuplicate('habits', item.name);
                      const isEditing = editingKey === key;
                      return (
                        <div className="brain-dump-item-wrap" key={key}>
                          <label className="brain-dump-item">
                            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                            <span>
                              <b>
                                {item.name}
                                {duplicate && <em className="dup-badge">Already exists</em>}
                              </b>
                              <small>{item.frequency}</small>
                            </span>
                            <button
                              type="button"
                              className="brain-dump-edit-btn"
                              onClick={e => {
                                e.preventDefault();
                                setEditingKey(isEditing ? null : key);
                              }}
                            >
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </label>
                          {isEditing && (
                            <div className="brain-dump-inline-edit">
                              <input
                                type="text"
                                maxLength={100}
                                value={item.name}
                                aria-label="Habit name"
                                onChange={e => updateItem('habits', index, { name: e.target.value })}
                              />
                              <select
                                value={item.frequency}
                                aria-label="Habit frequency"
                                onChange={e => updateItem('habits', index, { frequency: e.target.value as Habit['frequency'] })}
                              >
                                <option value="daily">Daily</option>
                                <option value="weekdays">Weekdays</option>
                                <option value="weekends">Weekends</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                {preview.tasks.length > 0 && (
                  <section className="brain-dump-section">
                    <h3>
                      Next actions<span>{preview.tasks.length}</span>
                    </h3>
                    {preview.tasks.map((item, index) => {
                      const key = `tasks:${index}`;
                      const duplicate = isDuplicate('tasks', item.title);
                      const isEditing = editingKey === key;
                      const detail = [item.projectTitle, item.priority, item.dueDate].filter(Boolean).join(' · ');
                      return (
                        <div className="brain-dump-item-wrap" key={key}>
                          <label className="brain-dump-item">
                            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                            <span>
                              <b>
                                {item.title}
                                {duplicate && <em className="dup-badge">Already exists</em>}
                              </b>
                              {detail && <small>{detail}</small>}
                            </span>
                            <button
                              type="button"
                              className="brain-dump-edit-btn"
                              onClick={e => {
                                e.preventDefault();
                                setEditingKey(isEditing ? null : key);
                              }}
                            >
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </label>
                          {isEditing && (
                            <div className="brain-dump-inline-edit">
                              <input
                                type="text"
                                maxLength={160}
                                value={item.title}
                                aria-label="Task title"
                                onChange={e => updateItem('tasks', index, { title: e.target.value })}
                              />
                              <select
                                value={item.priority}
                                aria-label="Task priority"
                                onChange={e => updateItem('tasks', index, { priority: e.target.value as Priority })}
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                              <input
                                type="date"
                                value={item.dueDate}
                                aria-label="Task due date"
                                onChange={e => updateItem('tasks', index, { dueDate: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="brain-dump-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <footer className="modal-actions brain-dump-actions">
          <button className="ui-btn ui-btn-outline" type="button" onClick={onClose}>
            Cancel
          </button>
          {preview ? (
            <button className="ui-btn ui-btn-solid" type="button" disabled={!selected.size} onClick={importSelected}>
              <Check size={15} /> Import {selected.size}
            </button>
          ) : (
            <button className="ui-btn ui-btn-solid" type="button" disabled={busy || text.trim().length < 20} onClick={analyze}>
              {busy ? (
                <>
                  <LoaderCircle size={15} className="spin" /> Analyzing
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Analyze draft
                </>
              )}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};