import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import ClientForm from '../components/ClientForm.jsx'
import styles from './ClientFormPage.module.css'

function NewClientPage() {
  const { createClient } = useAppData()
  const navigate = useNavigate()

  function handleCreateClient(fullName) {
    const client = createClient(fullName)

    navigate(`/clients/${client.id}`, {
      state: { notice: 'Client created for this preview session.' },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Client records</p>
      <h1>New client</h1>
      <p className={styles.introduction}>
        Create a client record before associating matters with it.
      </p>

      <ClientForm
        submitLabel="Create client"
        cancelTo="/clients"
        onSubmit={handleCreateClient}
      />
    </section>
  )
}

export default NewClientPage
