import { useEffect } from 'react';
import { AppState } from 'react-native';
import apiClient from '../../api/apiClient';
import { navigationRef } from '../../helpers/navigationRef';
import { CHINA_LIFE_CONFIG } from './chinaLifeConfig';
// Only foreground app activity. The visible game owns its own live heartbeat.
export default function useChinaLifeAppPresence(token) {
 useEffect(()=>{if(!token||!CHINA_LIFE_CONFIG)return undefined;let busy=false,alive=true;const controller=new AbortController();
 const pulse=async()=>{if(!alive||busy||AppState.currentState!=='active'||!navigationRef.isReady()||navigationRef.getCurrentRoute()?.name==='ChinaLife')return;busy=true;try{await apiClient.post('/chinalife/app-presence.php',{}, {signal:controller.signal});}catch{}finally{busy=false}};
 pulse();const timer=setInterval(pulse,15000),sub=AppState.addEventListener('change',state=>{if(state==='active')pulse()});return()=>{alive=false;controller.abort();clearInterval(timer);sub.remove()};
 },[token]);
}
