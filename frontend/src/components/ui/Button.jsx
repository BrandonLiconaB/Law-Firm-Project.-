import styles from './Button.module.css'

function Button({ children, variant = 'primary', type = 'button', ...buttonProps }) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]}`}
      {...buttonProps}
    >
      {children}
    </button>
  )
}

export default Button
