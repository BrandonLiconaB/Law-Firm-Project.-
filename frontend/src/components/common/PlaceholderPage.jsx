import { Link } from 'react-router'
import styles from './PlaceholderPage.module.css'

function PlaceholderPage({
  eyebrow,
  title,
  description,
  backTo = '/matters',
  backLabel = 'Back to matters',
}) {
  return (
    <section className={styles.page}>
      <div className={styles.icon} aria-hidden="true">
        !
      </div>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        <Link className={styles.backLink} to={backTo}>
          {backLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}

export default PlaceholderPage
