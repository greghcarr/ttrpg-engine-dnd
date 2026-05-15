import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element in index.html');

// Vite's `base` config means production assets live at /dndbnb/, so the
// router basename has to match. Dev runs at /.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
