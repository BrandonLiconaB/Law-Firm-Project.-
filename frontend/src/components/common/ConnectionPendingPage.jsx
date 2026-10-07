import PlaceholderPage from './PlaceholderPage.jsx'

function ConnectionPendingPage({ section }) {
  return <PlaceholderPage eyebrow="Connection pending" title={`${section} will be connected next`}
    description="This section is not connected to the database yet. No preview records are shown or saved here. You can configure your matter types and templates now."
    backTo="/admin/templates" backLabel="Open templates" />
}

export default ConnectionPendingPage
