import styles from './UserForm.module.css'

function UserFormField({ id, label, error, help, ...inputProps }) {
  const descriptionId = error ? `${id}-error` : help ? `${id}-help` : undefined
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...inputProps} />
    {error ? <small id={descriptionId} className={styles.errorMessage}>{error}</small>
      : help && <small id={descriptionId} className={styles.helpText}>{help}</small>}
  </div>
}

export default UserFormField
