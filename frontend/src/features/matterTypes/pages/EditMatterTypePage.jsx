import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
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
        description="The requested matter type does not exist in the preview catalog."
        backTo="/admin/matter-types"
        backLabel="Back to matter types"
      />
    )
  }

  function handleUpdateMatterType(matterTypeData) {
    const updatedMatterType = updateMatterType(matterType.id, matterTypeData)

    if (!updatedMatterType) {
      return
    }

    navigate('/admin/matter-types', {
      state: {
        notice: 'Matter type updated for this preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Administration</p>
      <h1>Edit matter type</h1>
      <p className={styles.introduction}>
        Changes to the name are reflected wherever this matter type is shown.
      </p>

      <MatterTypeForm
        matterTypes={matterTypes}
        initialMatterType={matterType}
        submitLabel="Save changes"
        cancelTo="/admin/matter-types"
        onSubmit={handleUpdateMatterType}
      />

      <p className={styles.sessionNote}>
        Existing matter document lists remain unchanged.
      </p>
    </section>
  )
}

export default EditMatterTypePage
