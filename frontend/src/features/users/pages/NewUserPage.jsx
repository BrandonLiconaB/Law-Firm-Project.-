import { useNavigate } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
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
      <p className={styles.eyebrow}>Administration</p>
      <h1>New user</h1>
      <p className={styles.introduction}>
        Add a name and email to the internal user directory.
      </p>

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
