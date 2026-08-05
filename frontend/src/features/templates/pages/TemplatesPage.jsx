import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import {
  getMatterTypeTemplateStatus,
  isMatterTypeReady,
  MATTER_TYPE_TEMPLATE_STATUSES,
} from '../../matterTypes/utils/matterTypeTemplateStatus.js'
import styles from './TemplatesPage.module.css'

function TemplateStatus({ matterType }) {
  const templateStatus = getMatterTypeTemplateStatus(matterType)
  const isReady = templateStatus === MATTER_TYPE_TEMPLATE_STATUSES.READY

  return (
    <span
      className={`${styles.templateStatus} ${
        isReady ? styles.readyStatus : styles.requiredStatus
      }`}
    >
      {templateStatus}
    </span>
  )
}

function TemplatesPage() {
  const { matterTypes } = useAppData()
  const readyCount = matterTypes.filter(isMatterTypeReady).length
  const totalDocumentCount = matterTypes.reduce(
    (total, matterType) => total + matterType.documents.length,
    0,
  )

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="Templates"
        description="Configure the document requirements copied into every new matter."
        contextLabel="Template library"
        contextValue={`${totalDocumentCount} document requirements`}
      />

      <div className={styles.summaryGrid}>
        <article>
          <strong>{matterTypes.length}</strong>
          <span>Matter types</span>
        </article>
        <article>
          <strong>{readyCount}</strong>
          <span>Ready templates</span>
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
                <TemplateStatus matterType={matterType} />
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
