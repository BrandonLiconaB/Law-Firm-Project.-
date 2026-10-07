import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import TemplateDocumentForm from '../components/TemplateDocumentForm.jsx'
import styles from './TemplateDocumentFormPage.module.css'
import { useTemplate } from '../../catalog/useTemplate.js'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'

function NewTemplateDocumentPage() {
  const { matterTypeId } = useParams()
  const { createTemplateDocument } = useAppData()
  const navigate = useNavigate()
  const template = useTemplate(matterTypeId)
  const matterType = template.data
  if (template.status !== 'Ready') return <RequestFeedback loading={template.status === 'Loading'}
    message="Loading the template…" error={template.error} onRetry={template.retry} />

  if (!matterType) {
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Template not found"
        description="The requested document template does not exist in the catalog."
        backTo="/admin/templates"
        backLabel="Back to templates"
      />
    )
  }

  async function handleCreateDocument(documentData) {
    const document = await createTemplateDocument(matterType.id, documentData)

    if (!document) {
      return
    }

    navigate(`/admin/templates/${matterType.id}`, {
      state: {
        notice: 'Document saved to the template.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow={`Template · ${matterType.name}`}
        title="Add document"
        description="Add a document requirement to this template."
        contextLabel="Document order"
        contextValue={`Added as item ${matterType.documents.length + 1}`}
      />

      <TemplateDocumentForm
        documents={matterType.documents}
        sections={matterType.sections}
        submitLabel="Add document"
        cancelTo={`/admin/templates/${matterType.id}`}
        onSubmit={handleCreateDocument}
      />

      <p className={styles.sessionNote}>
        This definition is saved to the database. Matter tracking will be connected in a later block.
      </p>
    </section>
  )
}

export default NewTemplateDocumentPage
