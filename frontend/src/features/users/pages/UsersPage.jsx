import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useUsers } from '../useUsers.js'
import { getUsersPage } from '../utils/userValidation.js'
import PageHero from '../../../components/common/PageHero.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import Button from '../../../components/ui/Button.jsx'
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
  const { list, loadUsers } = useUsers()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = getUsersPage(searchParams.get('page'))
  useEffect(() => { loadUsers(page) }, [page, loadUsers])
  const isCurrentPage = list.page === page
  const ready = isCurrentPage && list.status === 'Ready'
  const loading = !isCurrentPage || list.status === 'Idle' || list.status === 'Loading'
  const users = ready ? list.data : []
  const pagination = ready ? list.pagination : null

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="Users"
        description="Create internal accounts and manage password access for your team."
        contextLabel="Accounts"
        contextValue={pagination ? `${pagination.total} ${pagination.total === 1 ? 'account' : 'accounts'}` : 'Internal workspace'}
        tone="teal"
        action={<ButtonLink to="/admin/users/new">New user</ButtonLink>}
      />

      <RequestFeedback loading={loading} message="Loading accounts…"
        error={isCurrentPage ? list.error : null} onRetry={() => loadUsers(page)} />
      {ready && <div className={styles.resultsHeader}>
        <p><strong>{users.length}</strong> accounts on this page</p>
        <Button variant="secondary" onClick={() => loadUsers(page)}>Refresh list</Button>
      </div>}

      {ready && (users.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Password setup</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userIdentity}>
                        <span aria-hidden="true">{getInitials(user.fullName)}</span>
                        <div><strong>{user.fullName}</strong>
                          {user.systemRole === 'ADMIN' && <small className={styles.adminLabel}>Administrator</small>}</div>
                      </div>
                    </td>
                    <td>{user.username}</td>
                    <td><span className={`${styles.passwordStatus} ${user.mustChangePassword ? styles.required : ''}`}>
                      {user.mustChangePassword ? 'Personal password required' : 'Personal password set'}</span></td>
                    <td>
                      <Link
                        className={styles.viewLink}
                        to={`/admin/users/${user.id}`}
                        aria-label={`View ${user.fullName}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {users.map((user) => (
              <article className={styles.userCard} key={user.id}>
                <div className={styles.cardIdentity}>
                  <span aria-hidden="true">{getInitials(user.fullName)}</span>
                  <div>
                    <h2>{user.fullName}</h2>
                    <p>{user.username}</p>
                    {user.systemRole === 'ADMIN' && <small className={styles.adminLabel}>Administrator</small>}
                  </div>
                </div>
                <p className={`${styles.passwordStatus} ${user.mustChangePassword ? styles.required : ''}`}>
                  {user.mustChangePassword ? 'Personal password required' : 'Personal password set'}</p>
                <Link
                  className={styles.cardAction}
                  to={`/admin/users/${user.id}`}
                  aria-label={`View ${user.fullName}`}
                >
                  View account
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>{pagination.total ? 'No accounts on this page' : 'No accounts found'}</h2>
          <p>{pagination.total ? 'Return to the first page to view the directory.' : 'Create an internal account to get started.'}</p>
          {page > 1 && <Button variant="secondary" onClick={() => setSearchParams({ page: '1' })}>First page</Button>}
        </div>
      ))}
      {pagination && <nav className={styles.pagination} aria-label="User list pages">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>Previous</Button>
        <p>Page {page}{page > Math.max(1, pagination.totalPages) ? ' · outside directory' : ` of ${Math.max(1, pagination.totalPages)}`}</p>
        <Button variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setSearchParams({ page: String(page + 1) })}>Next</Button>
      </nav>}
    </section>
  )
}

export default UsersPage
