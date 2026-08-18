export function cleanTemplateSectionName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeTemplateSectionName(name) {
  return cleanTemplateSectionName(name).toLocaleLowerCase('en-US')
}

export function isTemplateSectionNameDuplicate(
  sections,
  sectionName,
  excludedSectionId = null,
) {
  const normalizedName = normalizeTemplateSectionName(sectionName)

  return sections.some(
    (section) =>
      section.id !== excludedSectionId &&
      normalizeTemplateSectionName(section.name) === normalizedName,
  )
}
