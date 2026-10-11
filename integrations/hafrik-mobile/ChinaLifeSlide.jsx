import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, G, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily } from '../../theme';

function CityScene({ width, height }) {
  return <Svg width={width} height={height} viewBox="0 0 280 240" pointerEvents="none">
    <Circle cx="176" cy="88" r="70" fill={Colors.java} opacity="0.25" />
    <Path d="M10 174 L143 106 L275 173 L142 239 Z" fill={Colors.java} opacity="0.4" />
    <Path d="M28 174 L144 116 L259 173 L143 231 Z" fill={Colors.cyprus} />
    <Path d="M40 175 L141 124 M72 193 L172 140 M110 211 L214 158 M89 145 L207 207 M128 128 L244 189" stroke={Colors.honeydew} strokeWidth="2" opacity="0.15" />
    {[{x:76,y:91,h:74},{x:118,y:48,h:117},{x:161,y:77,h:88}].map(({x,y,h})=><G key={x}>
      <Path d={`M${x} ${y} l24 -12 l24 12 l-24 12 Z`} fill={Colors.goldenTainoi} />
      <Path d={`M${x} ${y} l24 12 v${h} l-24 -12 Z`} fill="#D5A44C" />
      <Path d={`M${x+24} ${y+12} l24 -12 v${h} l-24 12 Z`} fill="#F5CD7D" />
      {[20,36,52].filter(n=>n<h).map(n=><Rect key={n} x={x+7} y={y+n} width="9" height="4" fill={Colors.cyprus} opacity="0.7" />)}
    </G>)}
    <Circle cx="199" cy="186" r="7" fill={Colors.honeydew} /><Circle cx="74" cy="193" r="6" fill={Colors.goldenTainoi} />
    <Path d="M198 201 v-8 M74 207 v-8" stroke={Colors.honeydew} strokeWidth="5" strokeLinecap="round" />
  </Svg>;
}
function ChinaLifeSlide({ item, slideWidth, slideHeight, onPress, cardStyle }) {
  return <TouchableOpacity onPress={()=>onPress(item)} activeOpacity={0.92} accessibilityRole="button" accessibilityLabel="ChinaLife. Your city, your story. Play inside Hafrik." style={{width:slideWidth}}>
    <View style={[s.card,{height:slideHeight},cardStyle]}>
      <LinearGradient colors={[Colors.cyprus,'#082B30']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={s.art}><CityScene width={slideWidth*0.63} height={slideHeight*0.92} /></View>
      <View style={s.content}>
        <View style={s.tag}><View style={s.dot}/><Text style={s.tagText}>CHINALIFE · PLAY IN HAFRIK</Text></View>
        <Text style={s.title}>Your city.{ '\n' }Your story.</Text>
        <Text style={s.body}>Meet people. Explore China.{ '\n' }Build a life together.</Text>
        <View style={s.button}><Ionicons name="game-controller" size={16} color={Colors.cyprus}/><Text style={s.buttonText}>Enter ChinaLife</Text><Ionicons name="arrow-forward" size={15} color={Colors.cyprus}/></View>
      </View>
    </View>
  </TouchableOpacity>;
}
const s=StyleSheet.create({
  card:{borderRadius:28,overflow:'hidden',backgroundColor:Colors.cyprus,borderWidth:1,borderColor:Colors.java},
  art:{position:'absolute',right:-24,bottom:-4,opacity:0.9},content:{flex:1,padding:20,alignItems:'flex-start',justifyContent:'center'},
  tag:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:12},dot:{width:5,height:5,borderRadius:3,backgroundColor:Colors.goldenTainoi},tagText:{fontFamily:FontFamily.readexSemiBold,fontSize:8,letterSpacing:0.7,color:Colors.honeydew},
  title:{fontFamily:FontFamily.readexSemiBold,fontSize:29,lineHeight:34,color:Colors.honeydew},body:{fontFamily:FontFamily.readexRegular,fontSize:10,lineHeight:16,color:Colors.honeydew,marginTop:8,maxWidth:'56%'},
  button:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:10,borderRadius:13,backgroundColor:Colors.goldenTainoi,marginTop:14},buttonText:{fontFamily:FontFamily.readexSemiBold,fontSize:11,color:Colors.cyprus},
});
export default memo(ChinaLifeSlide);
