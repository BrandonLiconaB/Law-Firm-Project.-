import { Link } from 'react-router'
import styles from './ButtonLink.module.css'

function ButtonLink({ children, to, variant = 'primary' }) {
  return (
    <Link className={`${styles.button} ${styles[variant]}`} to={to}>
      {children}
    </Link>
  )
}

export default ButtonLink
