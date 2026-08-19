import { Redirect } from 'expo-router';
import { useMemo } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import type { ProfileMutationInput } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth.store';

export default function CriarPerfilScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const completeProfile = useAuthStore((state) => state.completeProfile);
  const getHomeRoute = useAuthStore((state) => state.getHomeRoute);
  const status = useAuthStore((state) => state.status);

  const initialName = useMemo(() => {
    const metadata = user?.user_metadata ?? {};
    return (
      profile?.nome ||
      String(metadata.display_name ?? metadata.nome ?? metadata.name ?? '').trim()
    );
  }, [profile?.nome, user?.user_metadata]);

  async function handleSubmit(values: ProfileMutationInput) {
    try {
      await completeProfile(values);
    } catch (error) {
      Alert.alert('Erro ao criar perfil', error instanceof Error ? error.message : String(error));
    }
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (profile?.nome.trim()) {
    return <Redirect href={getHomeRoute()} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Seu perfil Party</Text>
        <Text style={styles.subtitle}>
          Escolha como voce quer aparecer no app antes de entrar nos eventos.
        </Text>
      </View>
      <ProfileForm
        initialProfile={profile}
        initialName={initialName}
        submitLabel="Concluir perfil"
        loading={status === 'loading'}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    gap: 8,
    paddingBottom: 18,
    paddingTop: 18,
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
  },
});
