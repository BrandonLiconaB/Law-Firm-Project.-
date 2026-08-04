import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import styles from './UsersPage.module.css'

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function UsersPage() {
  const { users } = useAppData()
  const location = useLocation()
  const [search, setSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return users.filter(
      (user) =>
        normalizedSearch.length === 0 ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch),
    )
  }, [search, users])

  return (
    <section className={styles.page}>
      {location.state?.notice && (
        <p className={styles.notice} role="status">
          {location.state.notice}
        </p>
      )}

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Administration</p>
          <h1>Users</h1>
          <p className={styles.introduction}>
            Maintain the name and email directory for internal application users.
          </p>
        </div>
        <ButtonLink to="/admin/users/new">New user</ButtonLink>
      </header>

      <div className={styles.previewNotice}>
        This directory is not connected to authentication or permissions yet.
      </div>

      <div className={styles.searchPanel}>
        <label htmlFor="user-search">Search</label>
        <input
          id="user-search"
          type="search"
          value={search}
          placeholder="Name or email"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.resultsHeader}>
        <p>
          <strong>{filteredUsers.length}</strong>{' '}
          {filteredUsers.length === 1 ? 'user' : 'users'}
        </p>
        {search && (
          <button type="button" onClick={() => setSearch('')}>
            Clear search
          </button>
        )}
      </div>

      {filteredUsers.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userIdentity}>
                        <span aria-hidden="true">{getInitials(user.name)}</span>
                        <strong>{user.name}</strong>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Link
                        className={styles.editLink}
                        to={`/admin/users/${user.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {filteredUsers.map((user) => (
              <article className={styles.userCard} key={user.id}>
                <div className={styles.cardIdentity}>
                  <span aria-hidden="true">{getInitials(user.name)}</span>
                  <div>
                    <h2>{user.name}</h2>
                    <p>{user.email}</p>
                  </div>
                </div>
                <Link
                  className={styles.cardAction}
                  to={`/admin/users/${user.id}/edit`}
                >
                  Edit user
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>No users found</h2>
          <p>Try a different name or email address.</p>
          <button type="button" onClick={() => setSearch('')}>
            Clear search
          </button>
        </div>
      )}

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default UsersPage
