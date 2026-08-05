import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
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
      <PageHero
        eyebrow="Administration"
        title="New matter type"
        description="Create a category now and configure its document template in the next administration step."
        contextLabel="Next step"
        contextValue="Add at least one key document"
        tone="indigo"
      />

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
