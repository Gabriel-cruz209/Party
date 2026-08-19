import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { EventForm } from '@/components/EventForm';
import { createEvent, type EventFormInput } from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

export default function CriarEventoScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(input: EventFormInput) {
    setLoading(true);

    try {
      const event = await createEvent(profile, input);
      router.replace({
        pathname: '/eventos/[eventoId]/gerenciar',
        params: { eventoId: event.id },
      });
    } catch (error) {
      Alert.alert('Erro ao criar evento', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Criar evento</Text>
          <Text style={styles.subtitle}>Configure seguranca, local, ingressos e capa.</Text>
        </View>
      </View>
      <EventForm submitLabel="Criar evento" loading={loading} onSubmit={handleSubmit} />
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 18,
    paddingTop: 18,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
  },
});
