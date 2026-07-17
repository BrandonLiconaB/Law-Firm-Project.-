import { Link } from 'react-router'
import styles from './ButtonLink.module.css'

function ButtonLink({ children, to }) {
  return (
    <Link className={styles.button} to={to}>
      {children}
    </Link>
  )
}

export default ButtonLink
