import { input, password } from '@inquirer/prompts'
import { closeDatabasePool } from '../src/db/pool.js'
import { AppError } from '../src/shared/AppError.js'
import {
  createInitialAdministrator,
  administratorExists,
} from '../src/modules/users/users.service.js'
import {
  fullNameSchema,
  passwordSchema,
  usernameSchema,
} from '../src/modules/users/user.validation.js'

function validateWith(schema) {
  return (value) => {
    const result = schema.safeParse(value)
    return result.success || result.error.issues[0].message
  }
}

async function collectAdministrator() {
  const fullName = await input({
    message: 'Full name:',
    validate: validateWith(fullNameSchema),
  })
  const username = await input({
    message: 'Username:',
    validate: validateWith(usernameSchema),
  })
  const administratorPassword = await password({
    message: 'Password:',
    mask: '*',
    validate: validateWith(passwordSchema),
  })
  const passwordConfirmation = await password({
    message: 'Confirm password:',
    mask: '*',
    validate: (value) =>
      value === administratorPassword || 'Passwords do not match.',
  })

  return {
    fullName,
    username,
    password: passwordConfirmation,
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('This command must be run in an interactive terminal.')
  }

  if (await administratorExists()) {
    throw new AppError({
      code: 'ADMIN_ALREADY_EXISTS',
      message: 'An administrator already exists. No changes were made.',
      statusCode: 409,
    })
  }

  const administrator = await collectAdministrator()
  const createdAdministrator = await createInitialAdministrator(administrator)

  console.log(
    `Administrator "${createdAdministrator.username}" created successfully.`,
  )
}

try {
  await main()
} catch (error) {
  if (error instanceof AppError || error.name === 'ExitPromptError') {
    console.error(error.message)
  } else {
    console.error('The administrator could not be created.')
  }

  process.exitCode = 1
} finally {
  await closeDatabasePool()
}
