import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import TemplateDocumentForm from '../components/TemplateDocumentForm.jsx'
import styles from './TemplateDocumentFormPage.module.css'
import { useTemplate } from '../../catalog/useTemplate.js'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'

function EditTemplateDocumentPage() {
  const { matterTypeId, documentId } = useParams()
  const { updateTemplateDocument } = useAppData()
  const navigate = useNavigate()
  const template = useTemplate(matterTypeId)
  const matterType = template.data
  if (template.status !== 'Ready') return <RequestFeedback loading={template.status === 'Loading'}
    message="Loading the template…" error={template.error} onRetry={template.retry} />
  const document = matterType?.documents.find(
    (currentDocument) => currentDocument.id === documentId,
  )

  if (!matterType || !document) {
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Document not found"
        description="The requested template document does not exist in the current template."
        backTo={
          matterType ? `/admin/templates/${matterType.id}` : '/admin/templates'
        }
        backLabel={matterType ? 'Back to template' : 'Back to templates'}
      />
    )
  }

  async function handleUpdateDocument(documentData) {
    const updatedDocument = await updateTemplateDocument(
      matterType.id,
      document.id,
      documentData,
    )

    if (!updatedDocument) {
      return
    }

    navigate(`/admin/templates/${matterType.id}`, {
      state: {
        notice: 'Template document saved to the database.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow={`Template · ${matterType.name}`}
        title="Edit document"
        description="Update this requirement while preserving its identifier."
        contextLabel="Current document"
        contextValue={document.name}
        tone="indigo"
      />

      <TemplateDocumentForm
        documents={matterType.documents}
        sections={matterType.sections}
        initialDocument={document}
        submitLabel="Save changes"
        cancelTo={`/admin/templates/${matterType.id}`}
        onSubmit={handleUpdateDocument}
      />

      <p className={styles.sessionNote}>
        Changes preserve the document UUID. Matter tracking will be connected in a later block.
      </p>
    </section>
  )
}

export default EditTemplateDocumentPage
