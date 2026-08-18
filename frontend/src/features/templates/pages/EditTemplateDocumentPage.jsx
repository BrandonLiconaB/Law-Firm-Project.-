import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import TemplateDocumentForm from '../components/TemplateDocumentForm.jsx'
import styles from './TemplateDocumentFormPage.module.css'

function EditTemplateDocumentPage() {
  const { matterTypeId, documentId } = useParams()
  const { matterTypes, updateTemplateDocument } = useAppData()
  const navigate = useNavigate()
  const matterType = matterTypes.find(
    (currentMatterType) => currentMatterType.id === matterTypeId,
  )
  const document = matterType?.documents.find(
    (currentDocument) => currentDocument.id === documentId,
  )

  if (!matterType || !document) {
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Document not found"
        description="The requested template document does not exist in the preview catalog."
        backTo={
          matterType ? `/admin/templates/${matterType.id}` : '/admin/templates'
        }
        backLabel={matterType ? 'Back to template' : 'Back to templates'}
      />
    )
  }

  function handleUpdateDocument(documentData) {
    const updatedDocument = updateTemplateDocument(
      matterType.id,
      document.id,
      documentData,
    )

    if (!updatedDocument) {
      return
    }

    navigate(`/admin/templates/${matterType.id}`, {
      state: {
        notice: 'Template document updated for this preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow={`Template · ${matterType.name}`}
        title="Edit document"
        description="Update how this requirement will appear in future matters."
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
        Existing matters will keep their current document information.
      </p>
    </section>
  )
}

export default EditTemplateDocumentPage
