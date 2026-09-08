export function isValidTitle(title) {
  if (typeof title !== "string") {
    return false;
  }

  const trimmedTitle = title.trim();

  return trimmedTitle.length >= 1 && trimmedTitle.length <= 200;
}

export function isValidJoinCode(code) {
  if (typeof code !== "string") {
    return false;
  }

  const normalizedCode = code.trim().toUpperCase();

  return /^[A-Z0-9]{6}$/.test(normalizedCode);
}