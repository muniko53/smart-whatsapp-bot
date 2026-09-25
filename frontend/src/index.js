import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Suppress the CRA error overlay for network errors in development
if (process.env.NODE_ENV === 'development') {
  const observer = new MutationObserver(() => {
    const overlay = document.getElementById('webpack-dev-server-client-overlay');
    if (overlay) overlay.remove();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
