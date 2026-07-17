import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import styles from './AppLayout.module.css'

const workspaceLinks = [
  { to: '/matters', label: 'Matters', initials: 'MT' },
  { to: '/clients', label: 'Clients', initials: 'CL' },
]

const administrationLinks = [
  { to: '/admin/matter-types', label: 'Matter types', initials: 'TY' },
  { to: '/admin/templates', label: 'Templates', initials: 'TP' },
  { to: '/admin/users', label: 'Users', initials: 'US' },
]

function NavigationLink({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
      }
    >
      <span className={styles.navIcon} aria-hidden="true">
        {item.initials}
      </span>
      <span>{item.label}</span>
    </NavLink>
  )
}

function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function closeMenu() {
    setIsMenuOpen(false)
  }

  return (
    <div className={styles.appShell}>
      <header className={styles.mobileHeader}>
        <div className={styles.mobileBrand}>
          <span className={styles.brandMark}>GD</span>
          <span>Gestor documental</span>
        </div>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </header>

      {isMenuOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      )}

      <aside
        className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>GD</span>
          <div>
            <strong>Gestor documental</strong>
            <span>Matter tracking</span>
          </div>
        </div>

        <nav className={styles.navigation} aria-label="Main navigation">
          <div className={styles.navGroup}>
            <p className={styles.navLabel}>Workspace</p>
            {workspaceLinks.map((item) => (
              <NavigationLink key={item.to} item={item} onNavigate={closeMenu} />
            ))}
          </div>

          <div className={styles.navGroup}>
            <p className={styles.navLabel}>Administration</p>
            {administrationLinks.map((item) => (
              <NavigationLink key={item.to} item={item} onNavigate={closeMenu} />
            ))}
          </div>
        </nav>

        <div className={styles.account}>
          <span className={styles.accountAvatar}>AU</span>
          <div className={styles.accountDetails}>
            <strong>Administrator</strong>
            <span>admin@example.com</span>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
