import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import UserForm from '../components/UserForm.jsx'
import styles from './UserFormPage.module.css'

function NewUserPage() {
  const { users, createUser } = useAppData()
  const navigate = useNavigate()

  function handleCreateUser(userData) {
    const user = createUser(userData)

    if (!user) {
      return
    }

    navigate('/admin/users', {
      state: {
        notice: 'User added to the frontend directory for this preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="New user"
        description="Add a name and email to the internal user directory."
        contextLabel="Directory record"
        contextValue="Authentication is configured later"
        tone="teal"
      />

      <UserForm
        users={users}
        submitLabel="Create user"
        cancelTo="/admin/users"
        onSubmit={handleCreateUser}
      />

      <p className={styles.sessionNote}>
        Creating this record does not create login credentials.
      </p>
    </section>
  )
}

export default NewUserPage
