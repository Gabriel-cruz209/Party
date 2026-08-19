import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatCurrency } from '@/services/event.service';
import { getMainFeed, type FeedEvent, type MainFeed } from '@/services/feed.service';
import type { MapCoordinate } from '@/services/map.service';
import { useAuthStore } from '@/stores/auth.store';

export default function FeedScreen() {
  const user = useAuthStore((state) => state.user);
  const [feed, setFeed] = useState<MainFeed>({
    friends: [],
    nearby: [],
    recommended: [],
  });
  const [center, setCenter] = useState<MapCoordinate | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);

    try {
      setFeed(await getMainFeed(user.id, center));
    } catch (error) {
      Alert.alert('Erro no feed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [center, user?.id]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Localizacao opcional', 'Sem localizacao, o feed mostra eventos por data e relevancia.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    setCenter({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Feed Party</Text>
          <Text style={styles.subtitle}>Eventos recomendados, amigos e proximos.</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.locationButton} onPress={requestLocation}>
          <MaterialCommunityIcons name={center ? 'crosshairs-gps' : 'crosshairs'} size={19} color="#0f172a" />
          <Text style={styles.locationButtonText}>{center ? 'Localizacao ativa' : 'Usar localizacao'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeed} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !feed.recommended.length ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#ef4444" />
            <Text style={styles.loadingText}>Montando feed...</Text>
          </View>
        ) : null}

        <FeedSection empty="Nenhum evento recomendado agora." events={feed.recommended} title="Recomendados" />
        <FeedSection empty="Eventos de amigos aparecem quando eles confirmam presenca." events={feed.friends} title="De amigos" />
        <FeedSection empty="Ative a localizacao para ver eventos proximos no mapa." events={feed.nearby} title="Proximos" />
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedSection({ empty, events, title }: { empty: string; events: FeedEvent[]; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {events.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rail}>
            {events.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>{empty}</Text>
      )}
    </View>
  );
}

function EventCard({ event }: { event: FeedEvent }) {
  return (
    <Pressable
      style={styles.eventCard}
      onPress={() =>
        router.push({
          pathname: '/eventos/[eventoId]/index',
          params: { eventoId: event.id },
        })
      }
    >
      {event.capaUrl ? (
        <Image source={{ uri: event.capaUrl }} style={styles.eventImage} />
      ) : (
        <View style={styles.eventFallback}>
          <MaterialCommunityIcons name="party-popper" size={28} color="#ef4444" />
        </View>
      )}
      <View style={styles.eventBody}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{event.tipo === 'privado' ? 'Privado' : 'Publico'}</Text>
          </View>
          {event.distanceKm !== null ? (
            <Text style={styles.distanceText}>{event.distanceKm.toFixed(1)} km</Text>
          ) : null}
        </View>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.titulo}
        </Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {event.localNome || 'Local a definir'}
        </Text>
        <Text style={styles.eventMeta}>
          {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
        </Text>
        {event.friendContext ? (
          <Text style={styles.friendContext} numberOfLines={1}>
            {event.friendContext} vai
          </Text>
        ) : null}
        <Text style={styles.priceText}>{formatCurrency(event.precoIngresso)}</Text>
      </View>
    </Pressable>
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
    paddingBottom: 12,
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
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  locationButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    gap: 24,
    paddingBottom: 34,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 26,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  rail: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 4,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    width: 248,
  },
  eventImage: {
    backgroundColor: '#e2e8f0',
    height: 126,
    width: '100%',
  },
  eventFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    height: 126,
    justifyContent: 'center',
    width: '100%',
  },
  eventBody: {
    gap: 7,
    padding: 12,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
  },
  distanceText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    minHeight: 42,
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  friendContext: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
  },
  priceText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
  },
});
