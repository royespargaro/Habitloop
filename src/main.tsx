import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { HabitProvider } from './context/HabitContext';
import './index.css';
import './styles/skin.css';

const rootElement = document.getElementById('root');

if (rootElement) createRoot(rootElement).render(<HabitProvider><App /></HabitProvider>);
