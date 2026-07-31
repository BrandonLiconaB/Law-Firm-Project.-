import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import ClientForm from '../components/ClientForm.jsx'
import styles from './ClientFormPage.module.css'

function EditClientPage() {
  const { clientId } = useParams()
  const { clients, updateClient } = useAppData()
  const navigate = useNavigate()
  const client = clients.find((currentClient) => currentClient.id === clientId)

  if (!client) {
    return (
      <PlaceholderPage
        eyebrow="Clients"
        title="Client not found"
        description="The client record you requested does not exist."
        backTo="/clients"
        backLabel="Back to clients"
      />
    )
  }

  function handleUpdateClient(fullName) {
    updateClient(client.id, fullName)

    navigate(`/clients/${client.id}`, {
      state: { notice: 'Client name updated for this preview session.' },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Client records</p>
      <h1>Edit client</h1>
      <p className={styles.introduction}>
        Update the client name shown across the client and matter views.
      </p>

      <ClientForm
        initialFullName={client.fullName}
        submitLabel="Save changes"
        cancelTo={`/clients/${client.id}`}
        onSubmit={handleUpdateClient}
      />
    </section>
  )
}

export default EditClientPage
