import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../../repository/store';
import { chinaLifeMilestoneDraft, isChinaLifeLaunchLink } from './chinaLifeExperience';
import { FontFamily } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../AuthContext';
import { CHINA_LIFE_CONFIG, isChinaLifeNavigationAllowed, chinaLifeSessionScript, chinaLifeHafrikDestination, chinaLifeActivityScript } from './chinaLifeConfig';

export default function ChinaLifeScreen({ navigation, route }) {
  const { colors, resolvedMode } = useTheme();
  const { user, token } = useAuth();
  const openComposer = useStore(state => state.openComposer);
  const composerOpen = useStore(state => state.isComposerOpen);
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const web = useRef(null);
  const failed = useRef(false);
  const loaded = useRef(false);
  const documentUrl = useRef(CHINA_LIFE_CONFIG?.url);
  const probe = useRef(null);
  const mounted = useRef(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const exit = useCallback(() => {
    web.current?.injectJavaScript(chinaLifeActivityScript(false));
    navigation.goBack();
  }, [navigation]);
  const openApp = (type) => {
    const destination = type === 'feed' ? { name: 'MainTabs', params: { chinaLifeReturn: true } } : chinaLifeHafrikDestination({ type });
    if (!destination) return;
    setAppsOpen(false);
    web.current?.injectJavaScript(chinaLifeActivityScript(false));
    // Push keeps ChinaLife beneath the app screen, even if that route already exists.
    navigation.push(destination.name, destination.params);
  };

  useEffect(() => {
    const update = (state = AppState.currentState) => web.current?.injectJavaScript(chinaLifeActivityScript(focused && !composerOpen && state === 'active'));
    update();
    const subscription = AppState.addEventListener('change', update);
    return () => subscription.remove();
  }, [focused, composerOpen]);
  useEffect(() => {
    if (focused) web.current?.injectJavaScript(chinaLifeSessionScript(token, user, CHINA_LIFE_CONFIG, resolvedMode));
  }, [focused, token, user, resolvedMode]);

  useEffect(() => {
    if (!focused) return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { exit(); return true; });
    return () => back.remove();
  }, [exit, focused]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; probe.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!loading || !CHINA_LIFE_CONFIG) return undefined;
    const timer = setTimeout(() => {
      failed.current = true;
      web.current?.stopLoading();
      setLoading(false);
      setError('load');
    }, 30000);
    return () => clearTimeout(timer);
  }, [loading]);

  const checkConnection = useCallback(async () => {
    if (!CHINA_LIFE_CONFIG || probe.current) return false;
    const controller = new AbortController();
    probe.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(CHINA_LIFE_CONFIG.url, {
        method: 'HEAD', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok || !isChinaLifeNavigationAllowed(response.url, CHINA_LIFE_CONFIG.origin, CHINA_LIFE_CONFIG.basePath)) throw new Error('Unavailable');
      if (mounted.current && !failed.current) setError(null);
      return true;
    } catch {
      if (mounted.current) setError('connection');
      return false;
    } finally {
      clearTimeout(timeout);
      if (probe.current === controller) probe.current = null;
    }
  }, []);

  useEffect(() => {
    if (!focused || !CHINA_LIFE_CONFIG) return undefined;
    const interval = setInterval(() => {
      if (loaded.current && AppState.currentState === 'active') checkConnection();
    }, 15000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && loaded.current) checkConnection();
    });
    return () => { clearInterval(interval); subscription.remove(); probe.current?.abort(); };
  }, [focused, checkConnection]);

  const retry = async () => {
    if (checking) return;
    setChecking(true);
    // Keep the existing game/document alive through temporary connection loss.
    const connected = await checkConnection();
    if (mounted.current) {
      setChecking(false);
      if (connected) {
        setError(null);
        if (failed.current || !loaded.current) {
          failed.current = false;
          setLoading(true);
          web.current?.reload();
        }
      }
    }
  };
  const failLoad = () => { failed.current = true; setLoading(false); setError('load'); };
  const config = CHINA_LIFE_CONFIG;
  const accountKey = String(user?.user_id ?? user?.id ?? 'test');

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={exit} style={styles.exit} accessibilityRole="button" accessibilityLabel="Back to Hafrik">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>China Life</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your Hafrik world</Text>
        </View>
        <TouchableOpacity onPress={() => setAppsOpen(true)} accessibilityLabel="Open Hafrik apps, keep game ready" style={[styles.exitLabel, { backgroundColor: colors.surfaceTint }]} accessibilityRole="button">
          <Text style={{ color: colors.text, fontFamily: FontFamily.readexSemiBold }}>Hafrik apps</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={appsOpen} transparent animationType="slide" onRequestClose={() => setAppsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setAppsOpen(false)} accessibilityLabel="Close Hafrik apps" accessibilityRole="button" />
          <View style={[styles.appsSheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
            <View style={styles.appsHeading}><Text style={[styles.stateTitle, { color: colors.text }]}>Your Hafrik, together</Text><TouchableOpacity onPress={() => setAppsOpen(false)} accessibilityLabel="Resume game"><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity></View>
            <Text style={[styles.appsHint, { color: colors.textSecondary }]}>Open an app. Go back to continue your game.</Text>
            <ScrollView contentContainerStyle={styles.appsGrid}>
              {[['feed','Hafrik feed','home-outline'],['business','Businesses','business-outline'],['space','Spaces','people-outline'],['people','Meet people','person-add-outline'],['event','Events','calendar-outline'],['course','Learning hub','school-outline'],['product','Marketplace','bag-outline'],['exchange','Exchange','swap-horizontal-outline']].map(([type,label,icon]) => <TouchableOpacity key={type} onPress={() => openApp(type)} style={[styles.appTile, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="button"><Ionicons name={icon} size={24} color={colors.accent} /><Text style={[styles.appLabel, { color: colors.text }]}>{label}</Text></TouchableOpacity>)}
            </ScrollView>
            <TouchableOpacity onPress={() => setAppsOpen(false)} style={[styles.button, { backgroundColor: colors.selected }]} accessibilityRole="button"><Text style={[styles.appLabel,{color:colors.onSelected}]}>Continue playing</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setAppsOpen(false); exit(); }} style={styles.back} accessibilityRole="button"><Text style={[styles.appLabel,{color:colors.textSecondary,textAlign:'center'}]}>Leave game</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.game}>
        {!!config && <WebView
          key={accountKey + (route?.params?.launchUrl || '')}
          ref={web}
          source={{ uri: isChinaLifeLaunchLink(route?.params?.launchUrl, config) ? route.params.launchUrl : config.url }}
          style={{ flex: 1, backgroundColor: colors.background }}
          javaScriptEnabled domStorageEnabled
          incognito={false}
          injectedJavaScriptBeforeContentLoaded={chinaLifeSessionScript(token, user, config, resolvedMode)}
          injectedJavaScript={chinaLifeSessionScript(token, user, config, resolvedMode)}
          onMessage={({ nativeEvent }) => {
            if (!isChinaLifeNavigationAllowed(nativeEvent.url, config.origin, config.basePath)) return;
            try {
              const message = JSON.parse(nativeEvent.data);
              if (message.type === 'chinalife:auth-request') web.current?.injectJavaScript(chinaLifeSessionScript(token, user, config, resolvedMode));
              if (message.type === 'chinalife:share-milestone' && token && !useStore.getState().isComposerOpen) {
                const draft = chinaLifeMilestoneDraft(message.milestone, config);
                if (draft) { web.current?.injectJavaScript(chinaLifeActivityScript(false, config)); openComposer(draft); }
              }
              if (message.type === 'chinalife:hafrik-open') {
                const destination = chinaLifeHafrikDestination(message.destination);
                if (destination) { web.current?.injectJavaScript(chinaLifeActivityScript(false, config)); navigation.push(destination.name, destination.params); }
              }
            } catch {}
          }}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          // Let the request callback deny ALL outside origins rather than
          // letting WebView's whitelist send them directly to the OS.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={({ url }) => isChinaLifeNavigationAllowed(url, config.origin, config.basePath)}
          onOpenWindow={() => { /* No external destinations approved for this pilot. */ }}
          javaScriptCanOpenWindowsAutomatically={false}
          mixedContentMode="never"
          allowFileAccess={false}
          allowsBackForwardNavigationGestures={false}
          allowsLinkPreview={false}
          automaticallyAdjustContentInsets={false}
          onLoadStart={({ nativeEvent }) => { documentUrl.current = nativeEvent.url; failed.current = false; setLoading(true); setProgress(0); }}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onLoad={() => {
            if (!failed.current) { loaded.current = true; setError(null); setLoading(false); web.current?.injectJavaScript(chinaLifeActivityScript(focused && !composerOpen && AppState.currentState === 'active', config)); }
          }}
          onError={failLoad}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.url === documentUrl.current) failLoad();
          }}
          onContentProcessDidTerminate={failLoad}
          onRenderProcessGone={failLoad}
          onFileDownload={() => { /* Game downloads are not enabled. */ }}
        />}
        {loading && !error && !!config && <View style={[styles.overlay, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Opening your world</Text>
          <Text style={{ color: colors.textSecondary }}>{Math.round(progress * 100)}%</Text>
        </View>}
        {(!config || error) && <View style={[styles.overlay, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
          <View style={[styles.icon, { backgroundColor: colors.surfaceTint }]}><Ionicons name={config ? 'cloud-offline-outline' : 'game-controller-outline'} size={34} color={colors.accent} /></View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>{config ? 'Let’s reconnect' : 'China Life is getting ready'}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{config ? 'We couldn’t reach the private world. Check your connection and try again.' : 'This private pilot will open once its host is configured.'}</Text>
          {!!config && <TouchableOpacity onPress={retry} disabled={checking} style={[styles.button, { backgroundColor: colors.selected }]} accessibilityRole="button">
            {checking ? <ActivityIndicator color={colors.onSelected} /> : <Text style={{ color: colors.onSelected, fontWeight: '700' }}>Try again</Text>}
          </TouchableOpacity>}
          <TouchableOpacity onPress={exit} style={styles.back} accessibilityRole="button"><Text style={{ color: colors.text }}>Back to Hafrik</Text></TouchableOpacity>
        </View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#061A1E88' }, appsSheet: { maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 }, appsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, appsHint: { fontFamily: FontFamily.readexRegular, fontSize: 13, lineHeight: 21, marginTop: 10, marginBottom: 18 }, appsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20 }, appTile: { width: '47%', padding: 16, minHeight: 88, borderRadius: 18, borderWidth: 1, gap: 10 }, appLabel: { fontFamily: FontFamily.readexMedium, fontSize: 13 },
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  exit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, titleBlock: { flex: 1 }, title: { fontSize: 18, fontFamily: FontFamily.readexSemiBold }, subtitle: { fontFamily: FontFamily.readexRegular, fontSize: 11, marginTop: 3 },
  exitLabel: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 }, game: { flex: 1 }, overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  icon: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, stateTitle: { fontSize: 22, fontFamily: FontFamily.readexSemiBold, textAlign: 'center' }, body: { fontFamily: FontFamily.readexRegular, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  button: { minWidth: 180, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, back: { padding: 14 },
});
