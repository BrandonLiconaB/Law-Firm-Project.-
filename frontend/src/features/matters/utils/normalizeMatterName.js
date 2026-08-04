export function cleanMatterName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeMatterName(value) {
  return cleanMatterName(value).toLowerCase()
}

export function isMatterNameDuplicate(
  matters,
  matterName,
  excludedMatterId = null,
) {
  const normalizedMatterName = normalizeMatterName(matterName)

  return matters.some(
    (matter) =>
      matter.id !== excludedMatterId &&
      normalizeMatterName(matter.matterName) === normalizedMatterName,
  )
}
