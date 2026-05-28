import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { ErrorBoundary } from './App.jsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
