import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline caching & standalone PWA installation
if ('serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Periodically check for updates in standalone mobile sessions
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      },
      onRegisterError() {
        // Ignore registration errors in restricted preview iframes
      },
    });
  } catch {
    // Graceful fallback if SW registration is unavailable
  }
}

createRoot(document.getElementById('root')!).render(<App />);
