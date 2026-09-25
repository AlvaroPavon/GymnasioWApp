import React, { useCallback, useState } from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BrandSplash from './src/components/BrandSplash';

const Stack = createNativeStackNavigator();

export default function App() {
  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const finishBrandSplash = useCallback(() => setShowBrandSplash(false), []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, primary: '#ff5a47', background: '#09090b', card: '#141416', text: '#fafafa', border: '#2a2a2e', notification: '#ff5a47' } }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#09090b' } }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      {showBrandSplash ? <BrandSplash onFinished={finishBrandSplash} /> : null}
    </SafeAreaProvider>
  );
}
