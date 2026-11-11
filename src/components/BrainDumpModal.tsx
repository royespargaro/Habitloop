import { useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Sparkles, X } from './Icon';
import type { BrainDumpPreview } from '../types';

type BrainDumpModalProps = {
  onClose: () => void;
  onImport: (items: BrainDumpPreview) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const hasStringFields = (value: unknown, fields: string[]) => isRecord(value) && fields.every(field => typeof value[field] === 'string');

function isBrainDumpPreview(value: unknown): value is BrainDumpPreview {
  if (!isRecord(value)) return false;
  return Array.isArray(value.lifeAreas) && value.lifeAreas.every(item => hasStringFields(item, ['name', 'description'])) &&
    Array.isArray(value.goals) && value.goals.every(item => hasStringFields(item, ['title', 'outcome', 'lifeAreaName', 'targetDate'])) &&
    Array.isArray(value.projects) && value.projects.every(item => hasStringFields(item, ['title', 'description', 'goalTitle', 'dueDate'])) &&
    Array.isArray(value.habits) && value.habits.every(item => hasStringFields(item, ['name', 'frequency'])) &&
    Array.isArray(value.tasks) && value.tasks.every(item => hasStringFields(item, ['title', 'projectTitle', 'dueDate', 'priority']));
}

export const BrainDumpModal = ({ onClose, onImport }: BrainDumpModalProps) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<BrainDumpPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    setError('');
    setBusy(true);
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
      if (!isBrainDumpPreview(result)) throw new Error('The AI response had an unexpected structure. Please try again.');

      setPreview(result);
      setSelected(new Set([
        ...result.lifeAreas.map((_, index) => `lifeAreas:${index}`),
        ...result.goals.map((_, index) => `goals:${index}`),
        ...result.projects.map((_, index) => `projects:${index}`),
        ...result.habits.map((_, index) => `habits:${index}`),
        ...result.tasks.map((_, index) => `tasks:${index}`),
      ]));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the AI service.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const importSelected = () => {
    if (!preview) return;
    onImport({
      lifeAreas: preview.lifeAreas.filter((_, index) => selected.has(`lifeAreas:${index}`)),
      goals: preview.goals.filter((_, index) => selected.has(`goals:${index}`)),
      projects: preview.projects.filter((_, index) => selected.has(`projects:${index}`)),
      habits: preview.habits.filter((_, index) => selected.has(`habits:${index}`)),
      tasks: preview.tasks.filter((_, index) => selected.has(`tasks:${index}`)),
    });
    onClose();
  };

  const sections = preview ? [
    { key: 'lifeAreas', title: 'Life areas', items: preview.lifeAreas.map(item => ({ title: item.name, detail: item.description })) },
    { key: 'goals', title: 'Goals', items: preview.goals.map(item => ({ title: item.title, detail: [item.lifeAreaName, item.outcome, item.targetDate].filter(Boolean).join(' · ') })) },
    { key: 'projects', title: 'Projects', items: preview.projects.map(item => ({ title: item.title, detail: [item.goalTitle, item.description, item.dueDate].filter(Boolean).join(' · ') })) },
    { key: 'habits', title: 'Habits', items: preview.habits.map(item => ({ title: item.name, detail: item.frequency })) },
    { key: 'tasks', title: 'Next actions', items: preview.tasks.map(item => ({ title: item.title, detail: [item.projectTitle, item.priority, item.dueDate].filter(Boolean).join(' · ') })) },
  ].filter(section => section.items.length) : [];

  return <div className="modal-backdrop brain-dump-backdrop" onMouseDown={onClose}>
    <section className="modal brain-dump-modal" role="dialog" aria-modal="true" aria-labelledby="brain-dump-title" onMouseDown={event => event.stopPropagation()}>
      <header className="modal-head">
        <div><div className="eyebrow">AI · review before import</div><h2 id="brain-dump-title">Brain dump</h2></div>
        <button className="icon-btn" type="button" aria-label="Close brain dump" onClick={onClose}><X size={18}/></button>
      </header>

      <div className="brain-dump-privacy"><Sparkles size={16}/><p>Your draft is sent to Google Gemini for parsing. Review every suggestion before importing; don’t include passwords or sensitive credentials.</p></div>

      {!preview ? <div className="brain-dump-compose">
        <label className="field"><span>Raw notes</span><textarea autoFocus maxLength={16000} rows={8} value={text} onChange={event => setText(event.target.value)} placeholder="Paste plans, meeting notes, or a life blueprint. InPursuit will suggest life areas, goals, projects, habits, and next actions."/></label>
        <div className="brain-dump-count">{text.length.toLocaleString()} / 16,000</div>
      </div> : <div className="brain-dump-preview">
        <div className="brain-dump-preview-head"><div><div className="eyebrow">suggested structure</div><p>{selected.size} selected · {sections.reduce((count, section) => count + section.items.length, 0)} found</p></div><button className="text-action" type="button" onClick={() => setPreview(null)}>Edit draft</button></div>
        {sections.length ? sections.map(section => <section className="brain-dump-section" key={section.key}>
          <h3>{section.title}<span>{section.items.length}</span></h3>
          {section.items.map((item, index) => {
            const key = `${section.key}:${index}`;
            return <label className="brain-dump-item" key={key}>
              <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)}/>
              <span><b>{item.title}</b>{item.detail && <small>{item.detail}</small>}</span>
            </label>;
          })}
        </section>) : <div className="brain-dump-empty">No structured items found. Edit the draft and try again with more specific details.</div>}
      </div>}

      {error && <div className="brain-dump-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}

      <footer className="modal-actions brain-dump-actions">
        <button className="ui-btn ui-btn-outline" type="button" onClick={onClose}>Cancel</button>
        {preview ? <button className="ui-btn ui-btn-solid" type="button" disabled={!selected.size} onClick={importSelected}><Check size={15}/> Import {selected.size}</button>
          : <button className="ui-btn ui-btn-solid" type="button" disabled={busy || text.trim().length < 20} onClick={analyze}>{busy ? <><LoaderCircle size={15} className="spin"/> Analyzing</> : <><Sparkles size={15}/> Analyze draft</>}</button>}
      </footer>
    </section>
  </div>;
}