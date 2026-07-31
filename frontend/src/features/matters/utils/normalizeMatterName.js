export function cleanMatterName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeMatterName(value) {
  return cleanMatterName(value).toLowerCase()
}

export function isMatterNameDuplicate(matters, matterName) {
  const normalizedMatterName = normalizeMatterName(matterName)

  return matters.some(
    (matter) => normalizeMatterName(matter.matterName) === normalizedMatterName,
  )
}
