import { input, password } from '@inquirer/prompts'
import { closeDatabasePool } from '../src/db/pool.js'
import { AppError } from '../src/shared/AppError.js'
import { recoverAdministrator } from '../src/modules/auth/password.service.js'
import { passwordSchema, usernameSchema } from '../src/modules/users/user.validation.js'

function validateWith(schema) {
  return (value) => {
    const result = schema.safeParse(value)
    return result.success || result.error.issues[0].message
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('This command must be run in an interactive terminal.')
  }

  const username = await input({
    message: 'Administrator username:',
    validate: validateWith(usernameSchema),
  })
  const newPassword = await password({
    message: 'New password:',
    mask: '*',
    validate: validateWith(passwordSchema),
  })
  await password({
    message: 'Confirm new password:',
    mask: '*',
    validate: (value) => value === newPassword || 'Passwords do not match.',
  })
  const administrator = await recoverAdministrator({ username, newPassword })
  console.log(`Administrator "${administrator.username}" recovered. All its sessions were revoked.`)
}

try {
  await main()
} catch (error) {
  if (error instanceof AppError || error.name === 'ExitPromptError') {
    console.error(error.message)
  } else {
    console.error('The administrator password could not be reset.')
  }
  process.exitCode = 1
} finally {
  await closeDatabasePool()
}
