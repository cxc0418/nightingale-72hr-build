import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- 必须有这一行，Tailwind 才会生效！

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)