// Public build settings only. Never put Hafrik tokens or launch tickets here.
export function getChinaLifeConfig(enabled, url) {
  if (enabled !== 'true') return null;
  try {
    const parsed = new URL(String(url || '').trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
    return { url: parsed.href, origin: parsed.origin, basePath: parsed.pathname };
  } catch { return null; }
}

export const CHINA_LIFE_CONFIG = getChinaLifeConfig(
  process.env.EXPO_PUBLIC_CHINA_LIFE_ENABLED,
  process.env.EXPO_PUBLIC_CHINA_LIFE_URL || 'https://hafrik.com/china-life/',
);

export function isChinaLifeNavigationAllowed(url, origin, basePath = '/') {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === origin && !parsed.username && !parsed.password
      && parsed.pathname.startsWith(basePath) && !parsed.pathname.includes('%');
  } catch { return false; }
}

// Apply to cached and fresh backend menus alike; never cache the local test item.
export function withChinaLifeTestMenu(items, config = CHINA_LIFE_CONFIG) {
  const others = items.filter(item => item?.route !== 'ChinaLife');
  return config ? [...others, {
    id: 'china_life_test', label: 'China Life · Test', icon: 'game-controller-outline',
    route: 'ChinaLife', section: 'explore', order: 5,
  }] : others;
}

// Only inject the app session into the configured game document. Tokens stay out of URLs.
export function chinaLifeSessionScript(token, user, config = CHINA_LIFE_CONFIG) {
  if (!token || !config) return 'true;';
  const session = JSON.stringify({token, user:{id:user?.user_id ?? user?.id, username:user?.username ?? user?.user_name, name:user?.name ?? user?.user_fullname}}).replace(/</g, '\\u003c');
  return `(function(){if(window.location.origin!==${JSON.stringify(config.origin)}||!window.location.pathname.startsWith(${JSON.stringify(config.basePath)}))return;if(window.HafrikSession&&window.HafrikSession.token===(${session}).token&&window.ChinaLifeAuth&&window.ChinaLifeAuth.token===(${session}).token)return;window.HafrikSession=${session};window.dispatchEvent(new CustomEvent('hafrik:session',{detail:window.HafrikSession}));})();true;`;
}
