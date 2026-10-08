// Give newly arriving players separate entry spots; network coordinates remain exact.
export function entryPosition(identity) {
  let hash = 2166136261;
  for (const character of String(identity || 'guest')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const slot = hash % 11;
  return {x:-4.5 + slot * .9,z:3.65};
}
export function roomPosition(value) {
  const bounds=value?.place==='night'?{x:8,z:6}:{x:6,z:4.5};
  return {x:Math.max(-bounds.x,Math.min(bounds.x,Number(value?.x) || 0)),z:Math.max(-bounds.z,Math.min(bounds.z,Number(value?.z) || 0))};
}
