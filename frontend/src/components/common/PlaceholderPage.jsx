import { Link } from 'react-router'
import styles from './PlaceholderPage.module.css'

function PlaceholderPage({ eyebrow, title, description }) {
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.description}>{description}</p>
      <Link className={styles.backLink} to="/matters">
        Back to matters
      </Link>
    </section>
  )
}

export default PlaceholderPage
