import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily } from '../../theme';
export default function ChinaLifeSharedLink() {
  const navigation = useNavigation();
  return <TouchableOpacity onPress={() => navigation.navigate('ChinaLife')} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Play ChinaLife inside Hafrik" style={s.card}>
    <View style={s.icon}><Ionicons name="game-controller" size={28} color={Colors.cyprus} /></View>
    <View style={s.copy}><Text style={s.title}>Play ChinaLife</Text><Text style={s.body}>Explore the city. Meet players. Build your story inside Hafrik.</Text></View>
    <Ionicons name="arrow-forward" size={20} color={Colors.honeydew} />
  </TouchableOpacity>;
}
const s=StyleSheet.create({card:{backgroundColor:Colors.cyprus,borderRadius:18,padding:18,flexDirection:'row',alignItems:'center',gap:12},icon:{backgroundColor:Colors.goldenTainoi,width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},copy:{flex:1},title:{fontFamily:FontFamily.readexSemiBold,fontSize:16,color:Colors.honeydew},body:{fontFamily:FontFamily.readexRegular,fontSize:11,lineHeight:17,color:Colors.honeydew,marginTop:6}});
