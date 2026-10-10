import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './components/App';
import { StoreProvider } from './state/store';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);