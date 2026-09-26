import { Router } from 'express'
import { createGetHealth } from './health.controller.js'

export function createHealthRouter({ database }) {
  const healthRouter = Router()

  healthRouter.get('/', createGetHealth({ database }))

  return healthRouter
}
