import { Link } from 'react-router'
import styles from './ButtonLink.module.css'

function ButtonLink({ children, to, variant = 'primary', disabled = false }) {
  if (disabled) return <span className={`${styles.button} ${styles[variant]}`} aria-disabled="true">{children}</span>
  return (
    <Link className={`${styles.button} ${styles[variant]}`} to={to}>
      {children}
    </Link>
  )
}

export default ButtonLink
