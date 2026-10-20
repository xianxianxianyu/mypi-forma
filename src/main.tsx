import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './vendor/transitions-ui-generation/ui-generation.css';
import 'katex/dist/katex.min.css';
import './components/intelligent/components/theme.css';
import './components/intelligent/components/components.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
