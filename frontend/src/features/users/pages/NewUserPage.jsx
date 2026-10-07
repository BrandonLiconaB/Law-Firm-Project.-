import { useNavigate } from 'react-router'
import { useUsers } from '../useUsers.js'
import PageHero from '../../../components/common/PageHero.jsx'
import UserForm from '../components/UserForm.jsx'
import styles from './UserFormPage.module.css'

function NewUserPage() {
  const { createUser, isMutating } = useUsers()
  const navigate = useNavigate()

  async function handleCreateUser(userData) {
    const user = await createUser(userData)
    navigate(`/admin/users/${user.id}`, {
      state: {
        notice: 'User created. A personal password is required on first sign-in.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <PageHero
        eyebrow="Administration"
        title="New user"
        description="Create an internal account with a username and temporary password."
        contextLabel="Account access"
        contextValue="Personal password required"
        tone="teal"
      />

      <UserForm
        isBusy={isMutating}
        onSubmit={handleCreateUser}
      />

      <p className={styles.sessionNote}>
        Passwords cannot be viewed again after creation.
      </p>
    </section>
  )
}

export default NewUserPage
