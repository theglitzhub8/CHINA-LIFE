import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { Colors, FontFamily } from '../../theme';
import { useAuth } from '../../AuthContext';
import apiClient from '../../api/apiClient';
import { CHINA_LIFE_CONFIG } from './chinaLifeConfig';
import { chinaLifeHomeState, chinaLifeWelcomeKey } from './chinaLifeExperience';

const dismissedWelcome = new Set();

export default function ChinaLifeLiveCard({ active = true }) {
  const { colors } = useTheme(), { user, token } = useAuth();
  const navigation = useNavigation(), focused = useIsFocused();
  const owner = String(user?.user_id ?? user?.id ?? '');
  const [snapshot, setSnapshot] = useState(null), [welcome, setWelcome] = useState(false);
  const state = snapshot?.owner === owner ? snapshot : { live: false, continuing: false };
  useEffect(() => {
    setWelcome(false);
    if (!CHINA_LIFE_CONFIG || !owner || !token || !focused || !active) return undefined;
    let alive = true, requesting = false, welcomed = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (requesting || AppState.currentState !== 'active') return;
      requesting = true;
      try {
        const results = await Promise.allSettled([
          apiClient.get('/chinalife/online.php', { signal: controller.signal }),
          apiClient.get('/chinalife/save.php', { signal: controller.signal }),
        ]);
        if (!alive) return;
        const [online,saved] = results.map(result => result.status === 'fulfilled' ? result.value.data : null);
        const next = chinaLifeHomeState(online, saved, owner);
        setSnapshot({ ...next, owner });
        if (next.live && !welcomed) {
          welcomed = true;
          const key = chinaLifeWelcomeKey(owner, CHINA_LIFE_CONFIG.origin);
          const seen = dismissedWelcome.has(key) || await AsyncStorage.getItem(key);
          if (alive && !seen) setWelcome(true);
        }
      } catch { /* Keep the card available if welcome storage is unavailable. */ }
      finally { requesting = false; }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { alive = false; controller.abort(); clearInterval(timer); subscription.remove(); };
  }, [owner, token, focused, active]);
  const dismiss = useCallback(() => {
    setWelcome(false);
    if (CHINA_LIFE_CONFIG && owner) { const key = chinaLifeWelcomeKey(owner, CHINA_LIFE_CONFIG.origin); dismissedWelcome.add(key); AsyncStorage.setItem(key, 'seen').catch(() => {}); }
  }, [owner]);
  const play = () => { dismiss(); navigation.navigate('ChinaLife'); };
  if (!CHINA_LIFE_CONFIG) return null;
  const label = state.continuing ? 'Continue playing' : 'Enter ChinaLife';
  return <>
    <TouchableOpacity onPress={play} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${label}. ${state.live ? state.online+' players online' : 'Explore your city in Hafrik'}`} style={[s.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <View style={s.scene}><Ionicons name="business" size={42} color={Colors.honeydew} /><View style={s.live}><View style={[s.dot,{backgroundColor:state.live?Colors.java:Colors.spaceTextTertiary}]} /><Text style={s.liveText}>{state.live?'LIVE':'CHINA LIFE'}</Text></View></View>
      <View style={s.copy}><Text style={[s.title,{color:colors.text}]}>{state.continuing?'Your city is waiting':'A whole world inside Hafrik'}</Text><Text style={[s.body,{color:colors.textSecondary}]}>{state.continuing&&state.city?`Continue in ${state.city}`:'Explore cities. Meet people. Build your story.'}</Text><Text style={[s.count,{color:colors.accent}]}>{state.live?`${state.online} ${state.online===1?'player':'players'} online · ${label}`:`${label} →`}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.accent} />
    </TouchableOpacity>
    <Modal transparent visible={welcome && focused && active} animationType="fade" onRequestClose={dismiss}>
      <View style={s.backdrop}><ScrollView style={[s.welcome,{backgroundColor:colors.background}]} contentContainerStyle={{padding:22}} accessibilityViewIsModal>
        <View style={s.welcomeScene}><Ionicons name="business" size={74} color={Colors.honeydew} /><Text style={s.welcomeLive}>CHINA LIFE IS LIVE</Text></View>
        <Text style={[s.welcomeTitle,{color:colors.text}]}>Your Hafrik world is open.</Text><Text style={[s.welcomeBody,{color:colors.textSecondary}]}>Explore the city, meet other players and connect with real Hafrik businesses, Spaces and events. Your feed is always a tap away.</Text>
        <TouchableOpacity onPress={play} style={[s.button,{backgroundColor:colors.selected}]} accessibilityRole="button"><Text style={[s.buttonText,{color:colors.onSelected}]}>{label}</Text></TouchableOpacity>
        <TouchableOpacity onPress={dismiss} style={s.later} accessibilityRole="button"><Text style={[s.buttonText,{color:colors.textSecondary}]}>Continue browsing Hafrik</Text></TouchableOpacity>
      </ScrollView></View>
    </Modal>
  </>;
}
const s=StyleSheet.create({
  card:{marginHorizontal:18,marginVertical:12,padding:14,borderRadius:22,borderWidth:1,flexDirection:'row',alignItems:'center',gap:12},scene:{width:76,height:92,backgroundColor:Colors.cyprus,borderRadius:17,alignItems:'center',justifyContent:'center',gap:8},live:{flexDirection:'row',alignItems:'center',gap:4},dot:{width:5,height:5,borderRadius:3},liveText:{fontFamily:FontFamily.readexSemiBold,fontSize:8,color:Colors.honeydew},copy:{flex:1},title:{fontFamily:FontFamily.readexSemiBold,fontSize:15,lineHeight:21},body:{fontFamily:FontFamily.readexRegular,fontSize:11,lineHeight:17,marginTop:5},count:{fontFamily:FontFamily.readexMedium,fontSize:10,lineHeight:16,marginTop:8},backdrop:{flex:1,backgroundColor:'#061A1E88',justifyContent:'center',padding:24},welcome:{borderRadius:28,maxHeight:'90%',flexGrow:0},welcomeScene:{backgroundColor:Colors.cyprus,borderRadius:20,padding:24,alignItems:'center',gap:16},welcomeLive:{fontFamily:FontFamily.readexSemiBold,fontSize:11,color:Colors.honeydew,letterSpacing:1},welcomeTitle:{fontFamily:FontFamily.readexSemiBold,fontSize:24,lineHeight:32,marginTop:22},welcomeBody:{fontFamily:FontFamily.readexRegular,fontSize:14,lineHeight:23,marginTop:12,marginBottom:24},button:{padding:16,borderRadius:15,alignItems:'center'},buttonText:{fontFamily:FontFamily.readexSemiBold,fontSize:13},later:{padding:16,alignItems:'center'},
});
