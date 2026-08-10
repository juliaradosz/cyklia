let saved = null;

export function saveCalState(s) {
  saved = s;
}

export function takeCalState() {
  const s = saved;
  saved = null;
  return s;
}

export function clearCalState() {
  saved = null;
}
