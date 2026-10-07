// Give newly arriving players separate entry spots; network coordinates remain exact.
export function entryPosition(identity) {
  let hash = 2166136261;
  for (const character of String(identity || 'guest')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const slot = hash % 11;
  return {x:-4.5 + slot * .9,z:3.65};
}
export function roomPosition(value) {
  return {x:Math.max(-6,Math.min(6,Number(value?.x) || 0)),z:Math.max(-4.5,Math.min(4.5,Number(value?.z) || 0))};
}
