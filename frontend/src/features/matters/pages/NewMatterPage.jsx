import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import MatterForm from '../components/MatterForm.jsx'
import styles from './NewMatterPage.module.css'

function NewMatterPage() {
  const { matterTypes, matters, createMatter } = useAppData()
  const navigate = useNavigate()

  function handleCreateMatter(matterData) {
    const matter = createMatter(matterData)

    if (!matter) {
      return
    }

    navigate(`/matters/${matter.id}`, {
      state: { notice: 'Matter created for this preview session.' },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Document control"
        title="New matter"
        description="Enter a unique 6-digit matter number and select its document template."
        contextLabel="New record"
        contextValue="Starts in Pending Documents"
      />

      <MatterForm
        matterTypes={matterTypes}
        matters={matters}
        onSubmit={handleCreateMatter}
      />

      <p className={styles.sessionNote}>
        Preview data is stored only while this browser session is open.
      </p>
    </section>
  )
}

export default NewMatterPage
