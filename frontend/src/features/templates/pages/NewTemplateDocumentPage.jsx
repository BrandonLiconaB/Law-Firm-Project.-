import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import TemplateDocumentForm from '../components/TemplateDocumentForm.jsx'
import styles from './TemplateDocumentFormPage.module.css'

function NewTemplateDocumentPage() {
  const { matterTypeId } = useParams()
  const { matterTypes, createTemplateDocument } = useAppData()
  const navigate = useNavigate()
  const matterType = matterTypes.find(
    (currentMatterType) => currentMatterType.id === matterTypeId,
  )

  if (!matterType) {
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Template not found"
        description="The requested document template does not exist in the preview catalog."
        backTo="/admin/templates"
        backLabel="Back to templates"
      />
    )
  }

  function handleCreateDocument(documentData) {
    const document = createTemplateDocument(matterType.id, documentData)

    if (!document) {
      return
    }

    navigate(`/admin/templates/${matterType.id}`, {
      state: {
        notice: 'Document added to this template for the preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow={`Template · ${matterType.name}`}
        title="Add document"
        description="Define a requirement that will be copied into future matters of this type."
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
        Existing matters will not receive this document automatically.
      </p>
    </section>
  )
}

export default NewTemplateDocumentPage
