// Public presentation only. Authentication is handled by the shared API client.
export function chinaLifeHomeState(online, saved, accountId = null) {
  const data = online?.status === 'success' ? online.data : null;
  const count = data?.online;
  const live = Number.isSafeInteger(count) && count >= 0;
  const game = saved?.status === 'success' && (accountId == null || String(saved.data?.account?.id) === String(accountId)) && saved.data?.exists ? saved.data.save?.game : null;
  return { live, online: live ? count : null, continuing: game?.created === true,
    city: typeof game?.city === 'string' && game.city.length <= 50 ? game.city : null };
}
export function chinaLifeWelcomeKey(accountId, origin) {
  return `chinalife_welcome_v1:${encodeURIComponent(String(accountId))}:${encodeURIComponent(origin)}`;
}
export function chinaLifeMilestoneDraft(value, config) {
  if (!config || !value || typeof value !== 'object') return null;
  if (!['rank','certificate','missions'].includes(value.kind)) return null;
  const clean = text => typeof text === 'string' && text.length > 0 && text.length <= 100 && !/[<>\u0000-\u001f]/.test(text);
  if (!clean(value.title) || !clean(value.city)) return null;
  const line = value.kind === 'rank' ? `I reached ${value.title} in ChinaLife!` : value.kind === 'certificate' ? `I earned ${value.title} in ChinaLife!` : `I completed ${value.title} in ChinaLife!`;
  // The game cannot provide a URL, audience, target profile, attachment or post action.
  return { initialTab: 'text', initialText: `${line}\nMy game city: ${value.city}.\n\nPlay with me: ${config.url}\n#ChinaLife #Hafrik` };
}

export function isChinaLifeLaunchLink(value, config) {
  if (!config) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    return url.protocol === 'https:' && url.origin === config.origin && path === config.basePath && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
