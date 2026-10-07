import { Link } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import { useAuth } from '../../auth/useAuth.js'
import {
  getMatterTypeTemplateStatus,
  isMatterTypeReady,
  MATTER_TYPE_TEMPLATE_STATUSES,
  getTemplateDocumentCount,
  getTemplateKeyCount,
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
  const { user } = useAuth()
  const canEdit = user.systemRole === 'ADMIN'
  const { matterTypes } = useAppData()
  const readyCount = matterTypes.filter(isMatterTypeReady).length
  const totalDocumentCount = matterTypes.reduce(
    (total, matterType) => total + getTemplateDocumentCount(matterType),
    0,
  )

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="Templates"
        description="View document requirements by matter type. Administrators can configure their sections and definitions."
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
          const keyDocumentCount = getTemplateKeyCount(matterType)

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
                  <dd>{getTemplateDocumentCount(matterType)}</dd>
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
                {canEdit ? 'Manage template' : 'View template'}
              </Link>
            </article>
          )
        })}
      </div>
      {matterTypes.length === 0 && <div className={styles.emptyState}>
        <h2>No templates yet</h2>
        <p>{canEdit ? 'Create a matter type first, then add its sections and documents.' : 'Ask your administrator to configure the document catalog.'}</p>
        {canEdit && <ButtonLink to="/admin/matter-types/new">New matter type</ButtonLink>}
      </div>}

      <p className={styles.sessionNote}>
        Templates are loaded from the database, not from preview data.
      </p>
    </section>
  )
}

export default TemplatesPage
