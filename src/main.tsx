import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import { initTheme } from './app/theme'
import { initDb } from './db/init'
import { App } from './app/App'

initTheme()

void initDb().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
