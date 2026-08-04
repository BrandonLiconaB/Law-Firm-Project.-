import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import MatterEditForm from '../components/MatterEditForm.jsx'
import styles from './EditMatterPage.module.css'

function EditMatterPage() {
  const { matterId } = useParams()
  const {
    matterRecords,
    matterTypes,
    matters,
    updateMatterDetails,
  } = useAppData()
  const navigate = useNavigate()
  const matter = matters.find((currentMatter) => currentMatter.id === matterId)
  const matterRecord = matterRecords[matterId]

  if (!matter || !matterRecord) {
    return (
      <PlaceholderPage
        eyebrow="Matters"
        title="Matter not found"
        description="The requested matter does not exist in the preview data."
        backTo="/matters"
        backLabel="Back to matters"
      />
    )
  }

  function handleUpdateMatter(matterData) {
    const result = updateMatterDetails(matter.id, matterData)

    if (!result) {
      return
    }

    navigate(`/matters/${matter.id}`, {
      state: {
        notice: result.matterTypeChanged
          ? 'Matter type changed. Document tracking was replaced and the workflow was reset.'
          : 'Matter name updated for this preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Administrator action</p>
      <h1>Edit matter</h1>
      <p className={styles.introduction}>
        Correct the matter name or replace its matter type and document checklist.
      </p>

      <MatterEditForm
        matter={matter}
        matterRecord={matterRecord}
        matterTypes={matterTypes}
        matters={matters}
        onSubmit={handleUpdateMatter}
      />

      <p className={styles.sessionNote}>
        Preview changes are stored only while this browser session is open.
      </p>
    </section>
  )
}

export default EditMatterPage
