export function cleanMatterName(value) {
  return value.trim()
}

export function isMatterNumberValid(value) {
  return /^[0-9]{6}$/.test(value)
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
