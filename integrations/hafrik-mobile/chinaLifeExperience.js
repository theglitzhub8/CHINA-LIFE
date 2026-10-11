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
  if (!['rank','certificate','missions','campaign'].includes(value.kind)) return null;
  const clean = text => typeof text === 'string' && text.length > 0 && text.length <= 100 && !/[<>\u0000-\u001f]/.test(text);
  if (!clean(value.title) || !clean(value.city)) return null;
  if (value.kind === 'campaign') {
    if (!['governor','deputy governor','city councillor','student representative'].includes(value.title)) return null;
    if (!Number.isSafeInteger(value.candidateId) || value.candidateId < 1) return null;
    const campaignUrl = `${config.url}#${new URLSearchParams({view:'voting',city:value.city,candidate:String(value.candidateId)})}`;
    return { initialTab: 'text', initialText: `I’m standing for ${value.title} in ChinaLife’s ${value.city}!\nOpen my campaign below and vote for my Hafrik username.\nYou can vote without standing for election. One vote per office.\n\n${campaignUrl}\n#ChinaLife #Hafrik` };
  }
  const line = value.kind === 'rank' ? `I reached ${value.title} in ChinaLife!` : value.kind === 'certificate' ? `I earned ${value.title} in ChinaLife!` : `I completed ${value.title} in ChinaLife!`;
  // The game cannot provide a URL, audience, target profile, attachment or post action.
  return { initialTab: 'text', initialText: `${line}\nMy game city: ${value.city}.\n\nPlay with me: ${config.url}\n#ChinaLife #Hafrik` };
}

export function isChinaLifeLaunchLink(value, config) {
  if (!config) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    return url.protocol === 'https:' && url.origin === config.origin && path === config.basePath && !url.username && !url.password && !url.search && (!url.hash || isChinaLifeCampaignHash(url.hash));
  } catch { return false; }
}

export function isChinaLifeCampaignHash(hash) {
  const p = new URLSearchParams(hash.slice(1));
  return [...p.keys()].length === 3 && p.get('view') === 'voting' && /^[1-9][0-9]{0,14}$/.test(p.get('candidate') || '') && Number.isSafeInteger(Number(p.get('candidate'))) && typeof p.get('city') === 'string' && p.get('city').length > 0 && p.get('city').length <= 100 && !/[<>\u0000-\u001f]/.test(p.get('city'));
}

// Account-owned saved snapshot, never another user's cached character.
export function chinaLifePlayerStats(saved, accountId) {
  if (!accountId || saved?.status !== 'success' || String(saved.data?.account?.id) !== String(accountId) || !saved.data?.exists) return null;
  const g = saved.data.save?.game;
  if (g?.created !== true) return null;
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  const xp = number(g.xp), money = number(g.money);
  const ranks = [[0,'Newcomer'],[200,'Explorer'],[600,'Local'],[1500,'Regular'],[3500,'Insider'],[7000,'Shenyang Star'],[12000,'Legend']];
  const rank = ranks.filter(([threshold]) => xp !== null && xp >= threshold).at(-1)?.[1] || 'Newcomer';
  const needs = ['energy','hunger','hygiene','bladder','fun','social'].map(key => g.needs?.[key]);
  const avg = needs.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) ? needs.reduce((sum,n) => sum+n,0)/6 : null;
  const hour = number(g.hour);
  const clock = hour === null ? null : `${String(Math.floor(hour/60)%24).padStart(2,'0')}:${String(hour%60).padStart(2,'0')}`;
  const mood = avg === null ? null : avg > 70 ? 'Feeling great' : avg > 40 ? 'Finding your rhythm' : 'Time to recharge';
  return { xp, money, rank, clock, mood, energy: typeof g.needs?.energy === 'number' && g.needs.energy >= 0 && g.needs.energy <= 100 ? Math.floor(g.needs.energy) : null };
}
