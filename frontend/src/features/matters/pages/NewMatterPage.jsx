import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import MatterForm from '../components/MatterForm.jsx'
import styles from './NewMatterPage.module.css'

function NewMatterPage() {
  const { matters, createMatter } = useAppData()
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
      <p className={styles.eyebrow}>Document control</p>
      <h1>New matter</h1>
      <p className={styles.introduction}>
        Enter the complete matter name and copy the selected document template
        into its record.
      </p>

      <MatterForm
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
