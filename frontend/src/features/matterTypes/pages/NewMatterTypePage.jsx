import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import MatterTypeForm from '../components/MatterTypeForm.jsx'
import styles from './MatterTypeFormPage.module.css'

function NewMatterTypePage() {
  const { matterTypes, createMatterType } = useAppData()
  const navigate = useNavigate()

  function handleCreateMatterType(matterTypeData) {
    const matterType = createMatterType(matterTypeData)

    if (!matterType) {
      return
    }

    navigate('/admin/matter-types', {
      state: {
        notice:
          'Matter type created. Add document requirements before using it in a new matter.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Administration</p>
      <h1>New matter type</h1>
      <p className={styles.introduction}>
        Create a category now and configure its document template in the next
        administration step.
      </p>

      <MatterTypeForm
        matterTypes={matterTypes}
        submitLabel="Create matter type"
        cancelTo="/admin/matter-types"
        onSubmit={handleCreateMatterType}
      />

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default NewMatterTypePage
