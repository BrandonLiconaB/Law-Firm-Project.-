import styles from './PageHero.module.css'

function PageHero({
  action,
  contextLabel,
  contextValue,
  description,
  eyebrow,
  title,
  tone = 'primary',
}) {
  const hasAside = action || contextLabel || contextValue

  return (
    <header className={`${styles.hero} ${styles[tone]}`}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>

      {hasAside && (
        <div className={styles.aside}>
          {(contextLabel || contextValue) && (
            <div className={styles.context}>
              {contextLabel && <span>{contextLabel}</span>}
              {contextValue && <strong>{contextValue}</strong>}
            </div>
          )}
          {action && <div className={styles.action}>{action}</div>}
        </div>
      )}
    </header>
  )
}

export default PageHero
