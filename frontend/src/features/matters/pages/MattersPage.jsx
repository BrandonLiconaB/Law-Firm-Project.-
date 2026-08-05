import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
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

  const matterSummary = useMemo(
    () => ({
      total: matters.length,
      pending: matters.filter((matter) => matter.status === 'Pending Documents')
        .length,
      draftReady: matters.filter((matter) =>
        ['Ready to Start Drafting', 'Ready to Draft'].includes(matter.status),
      ).length,
      completed: matters.filter((matter) =>
        ['Accepted', 'Sent'].includes(matter.status),
      ).length,
    }),
    [matters],
  )

  function clearFilters() {
    setSearch('')
    setStatus('')
    setMatterTypeId('')
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Document control"
        title="Matters"
        description="Track document readiness and the current workflow status for every matter."
        contextLabel="Workspace"
        contextValue="Internal matter tracking"
        action={<ButtonLink to="/matters/new">New matter</ButtonLink>}
      />

      <section className={styles.summaryGrid} aria-label="Matter overview">
        <article className={styles.summaryCard} data-tone="total">
          <span className={styles.summaryMarker} aria-hidden="true" />
          <div>
            <strong>{matterSummary.total}</strong>
            <span>Total matters</span>
          </div>
        </article>
        <article className={styles.summaryCard} data-tone="pending">
          <span className={styles.summaryMarker} aria-hidden="true" />
          <div>
            <strong>{matterSummary.pending}</strong>
            <span>Pending documents</span>
          </div>
        </article>
        <article className={styles.summaryCard} data-tone="ready">
          <span className={styles.summaryMarker} aria-hidden="true" />
          <div>
            <strong>{matterSummary.draftReady}</strong>
            <span>Drafting ready</span>
          </div>
        </article>
        <article className={styles.summaryCard} data-tone="complete">
          <span className={styles.summaryMarker} aria-hidden="true" />
          <div>
            <strong>{matterSummary.completed}</strong>
            <span>Accepted or sent</span>
          </div>
        </article>
      </section>

      <section className={styles.filterPanel} aria-labelledby="matter-filter-title">
        <div className={styles.filterHeader}>
          <div>
            <p className={styles.panelEyebrow}>Matter directory</p>
            <h2 id="matter-filter-title">Find a matter</h2>
          </div>
          <span>{hasFilters ? 'Filtered view' : 'All records'}</span>
        </div>

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
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <div className={styles.resultsHeader}>
        <p>
          Showing <strong>{filteredMatters.length}</strong>{' '}
          {filteredMatters.length === 1 ? 'matter' : 'matters'}
        </p>
        <span>{hasFilters ? 'Based on your current filters' : 'Most recent activity'}</span>
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
                        Open matter <span aria-hidden="true">→</span>
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
                  Open matter <span aria-hidden="true">→</span>
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
