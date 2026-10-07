import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import PageHero from '../../../components/common/PageHero.jsx'
import MatterTypeForm from '../components/MatterTypeForm.jsx'
import styles from './MatterTypeFormPage.module.css'

function EditMatterTypePage() {
  const { matterTypeId } = useParams()
  const { matterTypes, updateMatterType } = useAppData()
  const navigate = useNavigate()
  const matterType = matterTypes.find(
    (currentMatterType) => currentMatterType.id === matterTypeId,
  )

  if (!matterType) {
    return (
      <PlaceholderPage
        eyebrow="Matter types"
        title="Matter type not found"
        description="The requested matter type does not exist in the catalog."
        backTo="/admin/matter-types"
        backLabel="Back to matter types"
      />
    )
  }

  async function handleUpdateMatterType(matterTypeData) {
    const updatedMatterType = await updateMatterType(matterType.id, matterTypeData)

    if (!updatedMatterType) {
      return
    }

    navigate('/admin/matter-types', {
      state: {
        notice: 'Matter type saved to the database.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="Edit matter type"
        description="Changes to the name are reflected wherever this matter type is shown."
        contextLabel="Current type"
        contextValue={matterType.name}
        tone="indigo"
      />

      <MatterTypeForm
        matterTypes={matterTypes}
        initialMatterType={matterType}
        submitLabel="Save changes"
        cancelTo="/admin/matter-types"
        onSubmit={handleUpdateMatterType}
      />

      <p className={styles.sessionNote}>
        Renaming this category preserves its identifier and template definitions.
      </p>
    </section>
  )
}

export default EditMatterTypePage
