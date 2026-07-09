import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import { initTheme } from './app/theme'
import { initInstall } from './app/install'
import { initDb } from './db/init'
import { startSyncTriggers } from './sync/triggers'
import { App } from './app/App'

initTheme()
initInstall()
startSyncTriggers() // ambient sync triggers; no-op unless the user enabled sync

void initDb().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
