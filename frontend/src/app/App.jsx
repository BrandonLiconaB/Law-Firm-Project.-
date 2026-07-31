import { RouterProvider } from 'react-router/dom'
import { router } from '../routes/router.jsx'
import AppDataProvider from './providers/AppDataProvider.jsx'

function App() {
  return (
    <AppDataProvider>
      <RouterProvider router={router} />
    </AppDataProvider>
  )
}

export default App
