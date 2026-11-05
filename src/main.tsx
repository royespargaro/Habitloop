import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HabitProvider } from './context/HabitContext.tsx';

createRoot(document.getElementById('root')!).render(
    <HabitProvider>
        <App />
    </HabitProvider>
);
