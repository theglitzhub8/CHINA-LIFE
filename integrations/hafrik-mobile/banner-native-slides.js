const STUDY_SLIDE = {
  id: 'native-study-in-china',
  title: 'Your next chapter starts here',
  subtitle: 'Explore universities, programs, and scholarships in China.',
  tag: 'Study in China',
  image_asset: require('../../../assets/images/campus-fallback.jpg'),
  button_text: 'Explore study',
  action: { type: 'screen', value: 'BrowseUniversitiesScreen' },
};
const withStudySlide = (items, placement) => {
  if (placement !== 'home' || items.some(item => {
    const action = normalizeBannerAction(item);
    return (['screen', 'route'].includes(action.type) && action.value === 'BrowseUniversitiesScreen') || ['study', 'universities'].includes(action.type);
  })) return uniqueBanners(items);
  const result = [...items];
  result.splice(Math.min(1, result.length), 0, STUDY_SLIDE);
  return uniqueBanners(result);
};

// Rendered by ChinaLifeSlide (illustrated, animated) instead of ApiBannerSlide.
const CHINA_LIFE_SLIDE = {
  id: 'native-china-life',
  title: 'Your city. Your story.',
  subtitle: 'Meet people, explore China and build a life together.',
  tag: 'Play in Hafrik',
  button_text: 'Enter ChinaLife',
  action: { type: 'screen', value: 'ChinaLife' },
};
const CHINA_LIFE_PLACEMENTS = ['home', 'marketplace_home'];
// Only when the pilot is enabled for this build (the ChinaLife route only
// exists then). Slot 2 comes after the lead and before the study slide.
const withChinaLifeSlide = (items, placement) => {
  if (!CHINA_LIFE_CONFIG || !CHINA_LIFE_PLACEMENTS.includes(placement)) return items;
  const result = items.filter(item => {
    const action = normalizeBannerAction(item);
    return !(['screen', 'route'].includes(action.type) && action.value === 'ChinaLife');
  });
  result.splice(Math.min(1, result.length), 0, CHINA_LIFE_SLIDE);
  return result;
};
const withNativeSlides = (items, placement) => withChinaLifeSlide(withStudySlide(items, placement), placement);

