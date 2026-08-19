import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';

import {
  DEFAULT_MAP_FILTERS,
  applyMapFilters,
  getMapSnapshot,
  publishUserLocation,
  stopSharingUserLocation,
  subscribeToFriendLocationChanges,
  type FriendLocationPin,
  type MapCoordinate,
  type MapDateFilter,
  type MapEventPin,
  type MapFilters,
  type MapTypeFilter,
} from '@/services/map.service';
import { useAuthStore } from '@/stores/auth.store';

const TYPE_FILTERS: { label: string; value: MapTypeFilter }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Publicos', value: 'publico' },
  { label: 'Privados', value: 'privado' },
];

const DATE_FILTERS: { label: string; value: MapDateFilter }[] = [
  { label: 'Todas datas', value: 'todos' },
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: 'semana' },
];

export function MapScreen() {
  const user = useAuthStore((state) => state.user);
  const [center, setCenter] = useState<MapCoordinate | null>(null);
  const [events, setEvents] = useState<MapEventPin[]>([]);
  const [friends, setFriends] = useState<FriendLocationPin[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS);
  const [sharing, setSharing] = useState(false);

  const visibleEvents = useMemo(() => applyMapFilters(events, filters), [events, filters]);

  const loadSnapshot = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const snapshot = await getMapSnapshot(user.id, center);
    setEvents(snapshot.events);
    setFriends(snapshot.friends);
    setCategories(snapshot.categories);
  }, [center, user?.id]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    return subscribeToFriendLocationChanges(() => {
      void loadSnapshot();
    });
  }, [loadSnapshot]);

  function updateFilter<K extends keyof MapFilters>(key: K, value: MapFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function toggleSharing() {
    if (!user?.id) {
      return;
    }

    if (sharing) {
      await stopSharingUserLocation(user.id);
      setSharing(false);
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    setCenter(coordinate);
    await publishUserLocation({
      accuracyMeters: position.coords.accuracy,
      coordinate,
      userId: user.id,
      visibleEvents: events,
    });
    setSharing(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mapa Party</Text>
            <Text style={styles.subtitle}>
              {visibleEvents.length} eventos · {friends.length} amigos
            </Text>
          </View>
          <Pressable style={[styles.iconButton, sharing && styles.shareActive]} onPress={toggleSharing}>
            <MaterialCommunityIcons
              name={sharing ? 'map-marker-check' : 'map-marker-outline'}
              size={21}
              color={sharing ? '#ffffff' : '#0f172a'}
            />
          </Pressable>
        </View>

        <FilterRail>
          {TYPE_FILTERS.map((item) => (
            <FilterChip
              active={filters.tipo === item.value}
              key={item.value}
              label={item.label}
              onPress={() => updateFilter('tipo', item.value)}
            />
          ))}
        </FilterRail>

        <FilterRail>
          {DATE_FILTERS.map((item) => (
            <FilterChip
              active={filters.data === item.value}
              key={item.value}
              label={item.label}
              onPress={() => updateFilter('data', item.value)}
            />
          ))}
        </FilterRail>

        <FilterRail>
          <FilterChip
            active={filters.categoria === 'todas'}
            label="Todas"
            onPress={() => updateFilter('categoria', 'todas')}
          />
          {categories.map((category) => (
            <FilterChip
              active={filters.categoria === category}
              key={category}
              label={category}
              onPress={() => updateFilter('categoria', category)}
            />
          ))}
        </FilterRail>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eventos</Text>
          {visibleEvents.map((event) => (
            <Pressable
              key={event.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/eventos/[eventoId]/index',
                  params: { eventoId: event.id },
                })
              }
            >
              <View style={[styles.pinDot, event.tipo === 'privado' && styles.privateDot]} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{event.titulo}</Text>
                <Text style={styles.cardMeta}>
                  {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
                </Text>
                <Text style={styles.cardMeta}>{event.localNome || event.endereco}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#64748b" />
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amigos</Text>
          {friends.map((friend) => (
            <Pressable
              key={friend.usuarioId}
              style={styles.card}
              onPress={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${friend.latitude},${friend.longitude}`;
                void Linking.openURL(url);
              }}
            >
              <View style={styles.friendDot}>
                <Text style={styles.friendInitial}>
                  {(friend.perfil?.nome ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{friend.perfil?.nome ?? 'Amigo'}</Text>
                <Text style={styles.cardMeta}>
                  {friend.currentEvent ? friend.currentEvent.titulo : 'Sem evento detectado agora'}
                </Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={20} color="#64748b" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterRail({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.filterRail}>{children}</View>
    </ScrollView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  shareActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
  filterRail: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  filterChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    padding: 12,
  },
  pinDot: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  privateDot: {
    backgroundColor: '#7c3aed',
  },
  friendDot: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  friendInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
});
