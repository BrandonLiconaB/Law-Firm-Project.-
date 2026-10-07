import { getTemplate } from './templates.service.js'
import { createSection, deleteSection, moveSection, updateSection } from './sections.service.js'
import { createDocument, deleteDocument, moveDocument, updateTemplateDocument } from './documents.service.js'

export function createTemplatesController(database) {
  function mutation(operation, { created = false, removed = false } = {}) {
    return async (req, res) => {
      const { matterTypeId, sectionId, documentId } = req.validated.params
      const result = await operation(matterTypeId, sectionId ?? documentId, req.validated.body)
      if (removed) {
        res.status(204).end()
        return
      }
      res.status(created ? 201 : 200).json({ data: result.entity, templateRevision: result.templateRevision })
    }
  }

  return {
    get: async (req, res) => {
      const template = await getTemplate(req.validated.params.matterTypeId, database)
      res.status(200).json({ data: template })
    },
    createSection: mutation((typeId, id, input) => createSection(typeId, input, database), {
      created: true,
    }),
    updateSection: mutation((typeId, id, input) => updateSection(typeId, id, input, database)),
    moveSection: mutation((typeId, id, input) => moveSection(typeId, id, input, database)),
    deleteSection: mutation((typeId, id) => deleteSection(typeId, id, database), { removed: true }),
    createDocument: mutation((typeId, id, input) => createDocument(typeId, input, database), {
      created: true,
    }),
    updateDocument: mutation((typeId, id, input) => updateTemplateDocument(typeId, id, input, database)),
    moveDocument: mutation((typeId, id, input) => moveDocument(typeId, id, input, database)),
    deleteDocument: mutation((typeId, id) => deleteDocument(typeId, id, database), { removed: true }),
  }
}
