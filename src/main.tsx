import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AwardsPage from './AwardsPage.tsx'

const pagePath = window.location.pathname.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pagePath === '/awards' || pagePath === '/awards/admin' ? <AwardsPage admin={pagePath === '/awards/admin'} /> : <App />}
  </StrictMode>,
)
