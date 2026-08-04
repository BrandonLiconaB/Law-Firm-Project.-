import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import styles from './TemplatesPage.module.css'

function TemplateStatus({ documentCount }) {
  const isReady = documentCount > 0

  return (
    <span
      className={`${styles.templateStatus} ${
        isReady ? styles.readyStatus : styles.requiredStatus
      }`}
    >
      {isReady ? 'Ready' : 'Template required'}
    </span>
  )
}

function TemplatesPage() {
  const { matterTypes } = useAppData()
  const configuredCount = matterTypes.filter(
    (matterType) => matterType.documents.length > 0,
  ).length
  const totalDocumentCount = matterTypes.reduce(
    (total, matterType) => total + matterType.documents.length,
    0,
  )

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Administration</p>
        <h1>Templates</h1>
        <p className={styles.introduction}>
          Configure the document requirements copied into every new matter.
        </p>
      </header>

      <div className={styles.summaryGrid}>
        <article>
          <strong>{matterTypes.length}</strong>
          <span>Matter types</span>
        </article>
        <article>
          <strong>{configuredCount}</strong>
          <span>Configured templates</span>
        </article>
        <article>
          <strong>{totalDocumentCount}</strong>
          <span>Document requirements</span>
        </article>
      </div>

      <div className={styles.templateGrid}>
        {matterTypes.map((matterType) => {
          const keyDocumentCount = matterType.documents.filter(
            (document) => document.isKey,
          ).length

          return (
            <article className={styles.templateCard} key={matterType.id}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.cardLabel}>Matter type</p>
                  <h2>{matterType.name}</h2>
                </div>
                <TemplateStatus documentCount={matterType.documents.length} />
              </div>

              <p className={styles.description}>
                {matterType.description || 'No description has been provided.'}
              </p>

              <dl>
                <div>
                  <dt>Documents</dt>
                  <dd>{matterType.documents.length}</dd>
                </div>
                <div>
                  <dt>Key documents</dt>
                  <dd>{keyDocumentCount}</dd>
                </div>
              </dl>

              <Link
                className={styles.cardAction}
                to={`/admin/templates/${matterType.id}`}
              >
                Manage template
              </Link>
            </article>
          )
        })}
      </div>

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default TemplatesPage
