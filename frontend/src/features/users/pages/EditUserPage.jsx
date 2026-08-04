import { useNavigate, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import UserForm from '../components/UserForm.jsx'
import styles from './UserFormPage.module.css'

function EditUserPage() {
  const { userId } = useParams()
  const { users, updateUser } = useAppData()
  const navigate = useNavigate()
  const user = users.find((currentUser) => currentUser.id === userId)

  if (!user) {
    return (
      <PlaceholderPage
        eyebrow="Users"
        title="User not found"
        description="The requested user does not exist in the preview directory."
        backTo="/admin/users"
        backLabel="Back to users"
      />
    )
  }

  function handleUpdateUser(userData) {
    const updatedUser = updateUser(user.id, userData)

    if (!updatedUser) {
      return
    }

    navigate('/admin/users', {
      state: {
        notice: 'User directory record updated for this preview session.',
      },
    })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Administration</p>
      <h1>Edit user</h1>
      <p className={styles.introduction}>
        Update the name or email stored in the internal directory.
      </p>

      <UserForm
        users={users}
        initialUser={user}
        submitLabel="Save changes"
        cancelTo="/admin/users"
        onSubmit={handleUpdateUser}
      />

      <p className={styles.sessionNote}>
        This change does not affect authentication or permissions.
      </p>
    </section>
  )
}

export default EditUserPage
