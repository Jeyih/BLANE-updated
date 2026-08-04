import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onOfflineReady() {
    console.log('BLANE is ready to work offline.')
  },
  onNeedRefresh() {
    console.log('A new version is available and will be activated on reload.')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
