import {
  createMatterType,
  getMatterType,
  listMatterTypes,
  updateMatterType,
} from './matterTypes.service.js'

export function createMatterTypesController(database) {
  return {
    create: async (req, res) => {
      const matterType = await createMatterType(req.validated.body, database)
      res.location(`/api/matter-types/${matterType.id}`).status(201).json({ data: matterType })
    },
    list: async (req, res) => {
      const result = await listMatterTypes(req.validated.query, database)
      res.status(200).json(result)
    },
    getById: async (req, res) => {
      const matterType = await getMatterType(req.validated.params.id, database)
      res.status(200).json({ data: matterType })
    },
    update: async (req, res) => {
      const matterType = await updateMatterType(
        req.validated.params.id,
        req.validated.body,
        database,
      )
      res.status(200).json({ data: matterType })
    },
  }
}
