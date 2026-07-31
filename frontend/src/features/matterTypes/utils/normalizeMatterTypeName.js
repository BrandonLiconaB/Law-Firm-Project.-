export function cleanMatterTypeName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeMatterTypeName(value) {
  return cleanMatterTypeName(value).toLowerCase()
}

export function isMatterTypeNameDuplicate(
  matterTypes,
  matterTypeName,
  excludedMatterTypeId = null,
) {
  const normalizedMatterTypeName = normalizeMatterTypeName(matterTypeName)

  return matterTypes.some(
    (matterType) =>
      matterType.id !== excludedMatterTypeId &&
      normalizeMatterTypeName(matterType.name) === normalizedMatterTypeName,
  )
}
