import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import StatusBadge from '../../../components/ui/StatusBadge.jsx'
import { MATTER_STATUSES } from '../constants/matterStatuses.js'
import styles from './MattersPage.module.css'

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function MattersPage() {
  const { matterTypes, matters } = useAppData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [matterTypeId, setMatterTypeId] = useState('')

  const matterTypesById = useMemo(
    () => new Map(matterTypes.map((matterType) => [matterType.id, matterType])),
    [matterTypes],
  )

  const filteredMatters = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return matters.filter((matter) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        matter.matterName.toLowerCase().includes(normalizedSearch)
      const matchesStatus = status.length === 0 || matter.status === status
      const matchesType =
        matterTypeId.length === 0 || matter.matterTypeId === matterTypeId

      return matchesSearch && matchesStatus && matchesType
    })
  }, [matterTypeId, matters, search, status])

  const hasFilters =
    search.length > 0 || status.length > 0 || matterTypeId.length > 0

  function clearFilters() {
    setSearch('')
    setStatus('')
    setMatterTypeId('')
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
            placeholder="Name or matter identifier"
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
            {MATTER_STATUSES.map((option) => (
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
            value={matterTypeId}
            onChange={(event) => setMatterTypeId(event.target.value)}
          >
            <option value="">All matter types</option>
            {matterTypes.map((matterType) => (
              <option key={matterType.id} value={matterType.id}>
                {matterType.name}
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
                  <th>Matter name</th>
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
                        {matter.matterName}
                      </Link>
                    </td>
                    <td>
                      {matterTypesById.get(matter.matterTypeId)?.name ??
                        'Unknown matter type'}
                    </td>
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
                    <p className={styles.cardLabel}>Matter name</p>
                    <Link className={styles.matterLink} to={`/matters/${matter.id}`}>
                      {matter.matterName}
                    </Link>
                  </div>
                  <StatusBadge status={matter.status} />
                </div>
                <dl className={styles.cardDetails}>
                  <div>
                    <dt>Matter type</dt>
                    <dd>
                      {matterTypesById.get(matter.matterTypeId)?.name ??
                        'Unknown matter type'}
                    </dd>
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
