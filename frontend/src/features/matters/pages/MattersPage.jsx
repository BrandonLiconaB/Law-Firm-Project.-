import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import StatusBadge from '../../../components/ui/StatusBadge.jsx'
import { matters } from '../../../mocks/matters.js'
import styles from './MattersPage.module.css'

const statusOptions = [
  'Pending Documents',
  'Ready to Start Drafting',
  'Ready to Draft',
  'Ready to R/S',
  'Pending Corrections',
  'Corrections Ready',
  'Accepted',
  'Sent',
]

const matterTypeOptions = [...new Set(matters.map((matter) => matter.matterType))]

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function MattersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [matterType, setMatterType] = useState('')

  const filteredMatters = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return matters.filter((matter) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        matter.clientName.toLowerCase().includes(normalizedSearch) ||
        matter.matterNumber.toLowerCase().includes(normalizedSearch)
      const matchesStatus = status.length === 0 || matter.status === status
      const matchesType = matterType.length === 0 || matter.matterType === matterType

      return matchesSearch && matchesStatus && matchesType
    })
  }, [matterType, search, status])

  const hasFilters = search.length > 0 || status.length > 0 || matterType.length > 0

  function clearFilters() {
    setSearch('')
    setStatus('')
    setMatterType('')
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Document control</p>
          <h1>Matters</h1>
          <p className={styles.introduction}>
            Track document readiness and the current workflow status for every matter.
          </p>
        </div>
        <ButtonLink to="/matters/new">New matter</ButtonLink>
      </header>

      <div className={styles.filters}>
        <div className={styles.searchField}>
          <label htmlFor="matter-search">Search</label>
          <input
            id="matter-search"
            type="search"
            value={search}
            placeholder="Client name or matter number"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="type-filter">Matter type</label>
          <select
            id="type-filter"
            value={matterType}
            onChange={(event) => setMatterType(event.target.value)}
          >
            <option value="">All matter types</option>
            {matterTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button type="button" className={styles.clearButton} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className={styles.resultsHeader}>
        <p>
          <strong>{filteredMatters.length}</strong>{' '}
          {filteredMatters.length === 1 ? 'matter' : 'matters'}
        </p>
      </div>

      {filteredMatters.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Client</th>
                  <th>Matter type</th>
                  <th>Status</th>
                  <th>Last updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredMatters.map((matter) => (
                  <tr key={matter.id}>
                    <td>
                      <Link className={styles.matterLink} to={`/matters/${matter.id}`}>
                        {matter.matterNumber}
                      </Link>
                    </td>
                    <td>{matter.clientName}</td>
                    <td>{matter.matterType}</td>
                    <td>
                      <StatusBadge status={matter.status} />
                    </td>
                    <td>{formatDate(matter.updatedAt)}</td>
                    <td>
                      <Link className={styles.openLink} to={`/matters/${matter.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {filteredMatters.map((matter) => (
              <article className={styles.matterCard} key={matter.id}>
                <div className={styles.cardTopRow}>
                  <div>
                    <p className={styles.cardLabel}>Matter</p>
                    <Link className={styles.matterLink} to={`/matters/${matter.id}`}>
                      {matter.matterNumber}
                    </Link>
                  </div>
                  <StatusBadge status={matter.status} />
                </div>
                <dl className={styles.cardDetails}>
                  <div>
                    <dt>Client</dt>
                    <dd>{matter.clientName}</dd>
                  </div>
                  <div>
                    <dt>Matter type</dt>
                    <dd>{matter.matterType}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDate(matter.updatedAt)}</dd>
                  </div>
                </dl>
                <Link className={styles.cardAction} to={`/matters/${matter.id}`}>
                  Open matter
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>No matters found</h2>
          <p>Try changing your search or filters.</p>
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}

export default MattersPage
