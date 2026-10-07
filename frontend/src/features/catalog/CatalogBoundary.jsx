import { Outlet } from 'react-router'
import { useAppData } from '../../app/providers/useAppData.js'
import RequestFeedback from '../../components/common/RequestFeedback.jsx'

function CatalogBoundary() {
  const { status, error, loadCatalog } = useAppData()
  if (status !== 'Ready') return <RequestFeedback loading={status === 'Loading'} error={error}
    message="Loading the document catalog…" onRetry={loadCatalog} />
  return <Outlet />
}

export default CatalogBoundary
