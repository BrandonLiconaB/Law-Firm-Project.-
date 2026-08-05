import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import styles from './AppLayout.module.css'

const workspaceLinks = [
  { to: '/matters', label: 'Matters', initials: 'MT' },
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
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    window.matchMedia('(max-width: 960px)').matches,
  )
  const menuButtonRef = useRef(null)
  const sidebarRef = useRef(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 960px)')

    function updateLayout(event) {
      setIsMobileLayout(event.matches)
      if (!event.matches) {
        setIsMenuOpen(false)
      }
    }

    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }

    const sidebar = sidebarRef.current
    const menuButton = menuButtonRef.current
    const previousOverflow = document.body.style.overflow
    const focusableElements = Array.from(
      sidebar?.querySelectorAll('a[href], button:not([disabled])') ?? [],
    )

    document.body.style.overflow = 'hidden'
    focusableElements[0]?.focus()

    function handleMenuKeyboard(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        return
      }

      if (event.key !== 'Tab' || focusableElements.length === 0) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleMenuKeyboard)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleMenuKeyboard)
      menuButton?.focus()
    }
  }, [isMenuOpen])

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
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
          aria-controls="app-sidebar"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">{isMenuOpen ? '×' : '☰'}</span>
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
        id="app-sidebar"
        ref={sidebarRef}
        className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}
        aria-hidden={isMobileLayout && !isMenuOpen}
        inert={isMobileLayout && !isMenuOpen ? '' : undefined}
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
