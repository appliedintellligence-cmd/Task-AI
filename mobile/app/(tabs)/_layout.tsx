import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, View } from 'react-native';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline', repairs: 'hammer-outline', index: 'camera', lists: 'list-outline', profile: 'person-outline',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D3339',
          borderTopColor: '#234A50',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
        },
        tabBarActiveTintColor: '#F28B45',
        tabBarInactiveTintColor: '#B7CBC5',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.home} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="repairs"
        options={{
          title: 'Repairs', tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.repairs} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <View style={{ width: 58, height: 58, borderRadius: 29, marginTop: -26, backgroundColor: '#F28B45', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 }}><Ionicons name="camera" size={28} color="#102F36" /></View>,
          tabBarButton: ({ ref: _ref, ...props }) => <Pressable {...props} accessibilityLabel="Scan a repair" style={[props.style, { minWidth: 64, minHeight: 64 }]} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists', tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.lists} size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.profile} size={size} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
