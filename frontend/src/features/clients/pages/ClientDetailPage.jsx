import { Link, useLocation, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import StatusBadge from '../../../components/ui/StatusBadge.jsx'
import styles from './ClientDetailPage.module.css'

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function ClientDetailPage() {
  const { clientId } = useParams()
  const { clients, matters } = useAppData()
  const location = useLocation()
  const client = clients.find((currentClient) => currentClient.id === clientId)

  if (!client) {
    return (
      <PlaceholderPage
        eyebrow="Clients"
        title="Client not found"
        description="The client record you requested does not exist."
        backTo="/clients"
        backLabel="Back to clients"
      />
    )
  }

  const clientMatters = matters.filter(
    (matter) => matter.clientId === client.id,
  )

  return (
    <section className={styles.page}>
      {location.state?.notice && (
        <p className={styles.previewNotice}>{location.state.notice}</p>
      )}

      <Link className={styles.backLink} to="/clients">
        ← Back to clients
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Client record</p>
          <h1>{client.fullName}</h1>
          <p className={styles.metadata}>
            Created {formatDate(client.createdAt)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <ButtonLink to={`/clients/${client.id}/edit`} variant="secondary">
            Edit client
          </ButtonLink>
          <ButtonLink to={`/matters/new?clientId=${client.id}`}>
            New matter
          </ButtonLink>
        </div>
      </header>

      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Associated records</p>
          <h2>Matters</h2>
        </div>
        <p>
          {clientMatters.length}{' '}
          {clientMatters.length === 1 ? 'matter' : 'matters'}
        </p>
      </div>

      {clientMatters.length > 0 ? (
        <div className={styles.matterList}>
          {clientMatters.map((matter) => (
            <article className={styles.matterCard} key={matter.id}>
              <div className={styles.cardHeader}>
                <div>
                  <p>Matter</p>
                  <Link to={`/matters/${matter.id}`}>
                    {matter.matterNumber}
                  </Link>
                </div>
                <StatusBadge status={matter.status} />
              </div>
              <dl>
                <div>
                  <dt>Matter type</dt>
                  <dd>{matter.matterType}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(`${matter.updatedAt}T12:00:00`)}</dd>
                </div>
              </dl>
              <Link className={styles.cardAction} to={`/matters/${matter.id}`}>
                Open matter
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h2>No matters yet</h2>
          <p>Create the first matter associated with this client.</p>
          <ButtonLink to={`/matters/new?clientId=${client.id}`}>
            New matter
          </ButtonLink>
        </div>
      )}

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default ClientDetailPage
