import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline support — register the service worker (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', window.location.href).pathname).catch(() => {
      /* offline support is a bonus, never an error the user sees */
    });
  });
}
