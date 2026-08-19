import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { isProfileComplete } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth.store';

export default function BootstrapRoute() {
  const initialized = useAuthStore((state) => state.initialized);
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const getHomeRoute = useAuthStore((state) => state.getHomeRoute);

  if (!initialized || status === 'idle' || (session && status === 'loading' && !profile)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.text}>Abrindo o Party...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!isProfileComplete(profile)) {
    return <Redirect href="/criar-perfil" />;
  }

  return <Redirect href={getHomeRoute()} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  text: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
});
