import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Interceptação global de new Audio() para controle de reprodução no Stop do editor
if (typeof window !== 'undefined' && !(window as any).__orion_audio_patched__) {
  (window as any).__orion_audio_patched__ = true;
  (window as any).__orion_active_audios__ = new Set();
  
  const OriginalAudio = window.Audio;
  (window as any).Audio = function(...args: any[]) {
    const instance = new OriginalAudio(...args);
    (window as any).__orion_active_audios__.add(instance);
    return instance;
  } as any;
  (window as any).Audio.prototype = OriginalAudio.prototype;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
