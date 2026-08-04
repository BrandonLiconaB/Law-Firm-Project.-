import { Link, useLocation } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import styles from './MatterTypesPage.module.css'

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

function MatterTypesPage() {
  const { matterTypes } = useAppData()
  const location = useLocation()
  const readyCount = matterTypes.filter(
    (matterType) => matterType.documents.length > 0,
  ).length
  const templateRequiredCount = matterTypes.length - readyCount

  return (
    <section className={styles.page}>
      {location.state?.notice && (
        <p className={styles.notice} role="status">
          {location.state.notice}
        </p>
      )}

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Administration</p>
          <h1>Matter types</h1>
          <p className={styles.introduction}>
            Maintain the categories used to organize matters and their document
            templates.
          </p>
        </div>
        <ButtonLink to="/admin/matter-types/new">New matter type</ButtonLink>
      </header>

      <div className={styles.summaryGrid}>
        <article>
          <strong>{matterTypes.length}</strong>
          <span>Total matter types</span>
        </article>
        <article>
          <strong>{readyCount}</strong>
          <span>Ready for new matters</span>
        </article>
        <article>
          <strong>{templateRequiredCount}</strong>
          <span>Template required</span>
        </article>
      </div>

      {matterTypes.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Matter type</th>
                  <th>Template status</th>
                  <th>Documents</th>
                  <th>Key documents</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {matterTypes.map((matterType) => {
                  const keyDocumentCount = matterType.documents.filter(
                    (document) => document.isKey,
                  ).length

                  return (
                    <tr key={matterType.id}>
                      <td>
                        <strong>{matterType.name}</strong>
                        <p>
                          {matterType.description ||
                            'No description has been provided.'}
                        </p>
                      </td>
                      <td>
                        <TemplateStatus
                          documentCount={matterType.documents.length}
                        />
                      </td>
                      <td>{matterType.documents.length}</td>
                      <td>{keyDocumentCount}</td>
                      <td>
                        <div className={styles.rowActions}>
                        <Link
                          className={styles.editLink}
                          to={`/admin/matter-types/${matterType.id}/edit`}
                        >
                          Edit
                        </Link>
                          <Link
                            className={styles.editLink}
                            to={`/admin/templates/${matterType.id}`}
                          >
                            Template
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {matterTypes.map((matterType) => {
              const keyDocumentCount = matterType.documents.filter(
                (document) => document.isKey,
              ).length

              return (
                <article className={styles.matterTypeCard} key={matterType.id}>
                  <div className={styles.cardHeader}>
                    <h2>{matterType.name}</h2>
                    <TemplateStatus
                      documentCount={matterType.documents.length}
                    />
                  </div>
                  <p className={styles.cardDescription}>
                    {matterType.description ||
                      'No description has been provided.'}
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
                  <div className={styles.cardActions}>
                    <Link
                      className={styles.cardAction}
                      to={`/admin/matter-types/${matterType.id}/edit`}
                    >
                      Edit type
                    </Link>
                    <Link
                      className={styles.cardAction}
                      to={`/admin/templates/${matterType.id}`}
                    >
                      Template
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>No matter types yet</h2>
          <p>Create the first category for the document catalog.</p>
          <ButtonLink to="/admin/matter-types/new">
            New matter type
          </ButtonLink>
        </div>
      )}

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default MatterTypesPage
