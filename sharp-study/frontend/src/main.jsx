import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/index.js';
import './styles/index.css';  // Tailwind + theme variables — FIRST
import './index.css';          // now empty, safe to keep
import App from './App';
import './styles/globals.css';
import './styles/tokens.css';


// Register PWA service worker
/*if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.log('SW registration failed:', err));
  });
} */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);