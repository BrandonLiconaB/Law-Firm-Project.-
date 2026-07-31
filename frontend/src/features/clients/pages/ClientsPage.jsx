import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import styles from './ClientsPage.module.css'

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function ClientsPage() {
  const { clients, matters } = useAppData()
  const [search, setSearch] = useState('')

  const clientRows = useMemo(
    () =>
      clients.map((client) => {
        const clientMatters = matters.filter(
          (matter) => matter.clientId === client.id,
        )
        const matterUpdateDates = clientMatters.map(
          (matter) => new Date(`${matter.updatedAt}T12:00:00`).getTime(),
        )
        const latestTimestamp = Math.max(
          new Date(client.updatedAt).getTime(),
          ...matterUpdateDates,
        )

        return {
          ...client,
          matterCount: clientMatters.length,
          latestActivity: new Date(latestTimestamp).toISOString(),
        }
      }),
    [clients, matters],
  )

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return clientRows.filter(
      (client) =>
        normalizedSearch.length === 0 ||
        client.fullName.toLowerCase().includes(normalizedSearch),
    )
  }, [clientRows, search])

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Client records</p>
          <h1>Clients</h1>
          <p className={styles.introduction}>
            Find clients and review every matter associated with their record.
          </p>
        </div>
        <ButtonLink to="/clients/new">New client</ButtonLink>
      </header>

      <div className={styles.searchPanel}>
        <label htmlFor="client-search">Search</label>
        <input
          id="client-search"
          type="search"
          value={search}
          placeholder="Search by client name"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.resultsHeader}>
        <p>
          <strong>{filteredClients.length}</strong>{' '}
          {filteredClients.length === 1 ? 'client' : 'clients'}
        </p>
        {search && (
          <button type="button" onClick={() => setSearch('')}>
            Clear search
          </button>
        )}
      </div>

      {filteredClients.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Matters</th>
                  <th>Last activity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link
                        className={styles.clientLink}
                        to={`/clients/${client.id}`}
                      >
                        {client.fullName}
                      </Link>
                    </td>
                    <td>
                      {client.matterCount}{' '}
                      {client.matterCount === 1 ? 'matter' : 'matters'}
                    </td>
                    <td>{formatDate(client.latestActivity)}</td>
                    <td>
                      <Link
                        className={styles.openLink}
                        to={`/clients/${client.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {filteredClients.map((client) => (
              <article className={styles.clientCard} key={client.id}>
                <Link
                  className={styles.clientLink}
                  to={`/clients/${client.id}`}
                >
                  {client.fullName}
                </Link>
                <dl>
                  <div>
                    <dt>Matters</dt>
                    <dd>{client.matterCount}</dd>
                  </div>
                  <div>
                    <dt>Last activity</dt>
                    <dd>{formatDate(client.latestActivity)}</dd>
                  </div>
                </dl>
                <Link
                  className={styles.cardAction}
                  to={`/clients/${client.id}`}
                >
                  Open client
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>No clients found</h2>
          <p>Try a different client name.</p>
          <button type="button" onClick={() => setSearch('')}>
            Clear search
          </button>
        </div>
      )}
    </section>
  )
}

export default ClientsPage
