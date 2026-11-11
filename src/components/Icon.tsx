export type IconName =
  | 'today' | 'goals' | 'projects' | 'habits' | 'review'
  | 'add' | 'check' | 'close' | 'arrow-up' | 'arrow-down' | 'arrow-up-right'
  | 'calendar' | 'download' | 'upload' | 'flag' | 'activity' | 'archive'
  | 'list' | 'search' | 'settings' | 'trash' | 'spark' | 'target' | 'clock'
  | 'circle' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'spinner' | 'alert' | 'zap' | 'user';

const glyphs: Record<IconName, string> = {
  today: '', goals: '⨁', projects: '', habits: '', review: '',
  add: '+', check: '✓', close: '×', 'arrow-up': '↑', 'arrow-down': '↓', 'arrow-up-right': '↗',
  calendar: '', download: '↓', upload: '↑', flag: '⚑', activity: '∿', archive: '▱',
  list: '≡', search: '⌕', settings: '⎔', trash: '⌫', spark: '✳', target: '⨁', clock: '◷',
  circle: '○', 'chevron-down': '⌄', 'chevron-left': '‹', 'chevron-right': '›', spinner: '◌', alert: '!', zap: 'ϟ', user: '○',
};

type IconProps = { name: IconName; size?: number; className?: string };
type GlyphProps = { size?: number; className?: string };

export default function Icon({ name, size = 18, className = '' }: IconProps) {
  const classes = ['ip-icon', `ip-icon-${name}`, className].filter(Boolean).join(' ');
  const style = { width: size, height: size, fontSize: size };

  if (name === 'today') {
    return <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1"/><circle cx="12" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>;
  }
  if (name === 'projects') {
    return <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h6l2 2h9v11h-17z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter"/></svg>;
  }
  if (name === 'habits') {
    return <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter"/></svg>;
  }
  if (name === 'review') {
    return <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12h5l2-7 4 14 2-7h4l2-3h3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter"/></svg>;
  }
  if (name === 'calendar') {
    return <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h18v16H3zM3 9.5h18M8 3v5M16 3v5M7 13h2M12 13h2M17 13h1M7 17h2M12 17h2M17 17h1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter"/></svg>;
  }
  return <span className={classes} style={style} aria-hidden="true">{glyphs[name]}</span>;
}

const glyph = (name: IconName) => function TerminalGlyph({ size, className }: GlyphProps) {
  return <Icon name={name} size={size} className={className}/>;
};

export const Activity = glyph('activity');
export const Archive = glyph('archive');
export const ArrowDown = glyph('arrow-down');
export const ArrowUp = glyph('arrow-up');
export const ArrowUpRight = glyph('arrow-up-right');
export const BarChart3 = glyph('review');
export const CalendarDays = glyph('calendar');
export const Check = glyph('check');
export const CheckCircle2 = glyph('check');
export const ChevronDown = glyph('chevron-down');
export const ChevronLeft = glyph('chevron-left');
export const ChevronRight = glyph('chevron-right');
export const Circle = glyph('circle');
export const Clock3 = glyph('clock');
export const Download = glyph('download');
export const Flag = glyph('flag');
export const FolderKanban = glyph('projects');
export const LayoutDashboard = glyph('today');
export const ListTodo = glyph('list');
export const Plus = glyph('add');
export const Search = glyph('search');
export const Settings2 = glyph('settings');
export const Sparkles = glyph('spark');
export const Target = glyph('goals');
export const Trash2 = glyph('trash');
export const Upload = glyph('upload');
export const X = glyph('close');
export const User = glyph('user');
export const Zap = glyph('zap');
export const LoaderCircle = glyph('spinner');
export const AlertCircle = glyph('alert');