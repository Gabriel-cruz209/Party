import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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

type SelectedPin =
  | { type: 'event'; event: MapEventPin }
  | { type: 'friend'; friend: FriendLocationPin }
  | null;

const DEFAULT_REGION = {
  latitude: -23.55052,
  latitudeDelta: 0.11,
  longitude: -46.633308,
  longitudeDelta: 0.11,
};

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
  const [userLocation, setUserLocation] = useState<MapCoordinate | null>(null);
  const [events, setEvents] = useState<MapEventPin[]>([]);
  const [friends, setFriends] = useState<FriendLocationPin[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS);
  const [selectedPin, setSelectedPin] = useState<SelectedPin>(null);
  const [loading, setLoading] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const eventsRef = useRef<MapEventPin[]>([]);

  const visibleEvents = useMemo(() => applyMapFilters(events, filters), [events, filters]);
  const region = userLocation
    ? {
        latitude: userLocation.latitude,
        latitudeDelta: 0.09,
        longitude: userLocation.longitude,
        longitudeDelta: 0.09,
      }
    : DEFAULT_REGION;

  const loadSnapshot = useCallback(
    async (center = userLocation) => {
      if (!user?.id) {
        return;
      }

      setLoading(true);

      try {
        const snapshot = await getMapSnapshot(user.id, center);
        eventsRef.current = snapshot.events;
        setEvents(snapshot.events);
        setFriends(snapshot.friends);
        setCategories(snapshot.categories);
      } catch (error) {
        Alert.alert('Erro no mapa', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    },
    [user?.id, userLocation],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    return subscribeToFriendLocationChanges(() => {
      void loadSnapshot();
    });
  }, [loadSnapshot]);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
    };
  }, []);

  async function publishLocation(position: Location.LocationObject) {
    if (!user?.id) {
      return;
    }

    const coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    setUserLocation(coordinate);
    await publishUserLocation({
      accuracyMeters: position.coords.accuracy,
      coordinate,
      userId: user.id,
      visibleEvents: eventsRef.current,
    });
  }

  async function startLocationSharing() {
    if (!user?.id || sharingBusy) {
      return;
    }

    setSharingBusy(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Localizacao negada', 'Autorize a localizacao nas permissoes do aparelho.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await publishLocation(position);
      await loadSnapshot({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 15000,
        },
        (nextPosition) => {
          void publishLocation(nextPosition).catch(() => undefined);
        },
      );

      setSharingLocation(true);
    } catch (error) {
      Alert.alert('Erro na localizacao', error instanceof Error ? error.message : String(error));
    } finally {
      setSharingBusy(false);
    }
  }

  async function stopLocationSharing() {
    if (!user?.id || sharingBusy) {
      return;
    }

    setSharingBusy(true);

    try {
      watchRef.current?.remove();
      watchRef.current = null;
      await stopSharingUserLocation(user.id);
      setSharingLocation(false);
    } catch (error) {
      Alert.alert('Erro na localizacao', error instanceof Error ? error.message : String(error));
    } finally {
      setSharingBusy(false);
    }
  }

  function updateFilter<K extends keyof MapFilters>(key: K, value: MapFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={Boolean(userLocation)}
        style={styles.map}
      >
        {visibleEvents.map((event) => (
          <Marker
            coordinate={{
              latitude: event.latitude ?? DEFAULT_REGION.latitude,
              longitude: event.longitude ?? DEFAULT_REGION.longitude,
            }}
            key={event.id}
            onPress={() => setSelectedPin({ event, type: 'event' })}
            pinColor={event.tipo === 'privado' ? '#7c3aed' : '#ef4444'}
          />
        ))}

        {friends.map((friend) => (
          <Marker
            coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
            key={friend.usuarioId}
            onPress={() => setSelectedPin({ friend, type: 'friend' })}
          >
            <View style={styles.friendMarker}>
              {friend.perfil?.fotoUrl ? (
                <Image source={{ uri: friend.perfil.fotoUrl }} style={styles.friendMarkerImage} />
              ) : (
                <Text style={styles.friendMarkerInitial}>
                  {(friend.perfil?.nome ?? '?').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.topPanel}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mapa Party</Text>
            <Text style={styles.subtitle}>
              {visibleEvents.length} eventos · {friends.length} amigos
            </Text>
          </View>
          <Pressable
            style={[styles.shareButton, sharingLocation && styles.shareButtonActive]}
            onPress={sharingLocation ? stopLocationSharing : startLocationSharing}
            disabled={sharingBusy}
          >
            {sharingBusy ? (
              <ActivityIndicator color={sharingLocation ? '#ffffff' : '#0f172a'} />
            ) : (
              <MaterialCommunityIcons
                name={sharingLocation ? 'map-marker-check' : 'map-marker-outline'}
                size={20}
                color={sharingLocation ? '#ffffff' : '#0f172a'}
              />
            )}
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
      </View>

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator color="#ef4444" />
          <Text style={styles.loadingText}>Atualizando mapa...</Text>
        </View>
      ) : null}

      {selectedPin?.type === 'event' ? (
        <EventPinCard event={selectedPin.event} onClose={() => setSelectedPin(null)} />
      ) : null}

      {selectedPin?.type === 'friend' ? (
        <FriendPinCard friend={selectedPin.friend} onClose={() => setSelectedPin(null)} />
      ) : null}
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

function EventPinCard({ event, onClose }: { event: MapEventPin; onClose: () => void }) {
  return (
    <View style={styles.pinCard}>
      <Pressable style={styles.cardClose} onPress={onClose}>
        <MaterialCommunityIcons name="close" size={18} color="#0f172a" />
      </Pressable>
      {event.capaUrl ? (
        <Image source={{ uri: event.capaUrl }} style={styles.eventImage} />
      ) : (
        <View style={styles.eventImageFallback}>
          <MaterialCommunityIcons name="party-popper" size={30} color="#ef4444" />
        </View>
      )}
      <View style={styles.cardText}>
        <View style={styles.badgeRow}>
          <View style={[styles.eventBadge, event.tipo === 'privado' && styles.privateBadge]}>
            <Text style={[styles.eventBadgeText, event.tipo === 'privado' && styles.privateBadgeText]}>
              {event.tipo === 'privado' ? 'Privado' : 'Publico'}
            </Text>
          </View>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>{event.categoria}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{event.titulo}</Text>
        <Text style={styles.cardMeta}>
          {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
        </Text>
        <Pressable
          style={styles.detailsButton}
          onPress={() =>
            router.push({
              pathname: '/eventos/[eventoId]/index',
              params: { eventoId: event.id },
            })
          }
        >
          <MaterialCommunityIcons name="calendar-search" size={19} color="#ffffff" />
          <Text style={styles.detailsButtonText}>Ver detalhes</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FriendPinCard({ friend, onClose }: { friend: FriendLocationPin; onClose: () => void }) {
  return (
    <View style={styles.pinCard}>
      <Pressable style={styles.cardClose} onPress={onClose}>
        <MaterialCommunityIcons name="close" size={18} color="#0f172a" />
      </Pressable>
      {friend.perfil?.fotoUrl ? (
        <Image source={{ uri: friend.perfil.fotoUrl }} style={styles.avatarLarge} />
      ) : (
        <View style={styles.avatarFallbackLarge}>
          <Text style={styles.avatarInitialLarge}>
            {(friend.perfil?.nome ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{friend.perfil?.nome ?? 'Amigo'}</Text>
        <Text style={styles.cardMeta}>
          {friend.currentEvent ? friend.currentEvent.titulo : 'Sem evento detectado agora'}
        </Text>
        <Text style={styles.cardMeta}>
          Atualizado {new Date(friend.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {friend.currentEvent ? (
          <Pressable
            style={styles.detailsButton}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/index',
                params: { eventoId: friend.currentEvent?.id },
              })
            }
          >
            <MaterialCommunityIcons name="calendar-search" size={19} color="#ffffff" />
            <Text style={styles.detailsButtonText}>Ver evento</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topPanel: {
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
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
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  shareButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterRail: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  filterChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  loadingPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    position: 'absolute',
    top: 178,
  },
  loadingText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  friendMarker: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 3,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    width: 44,
  },
  friendMarkerImage: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  friendMarkerInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  pinCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 24,
    flexDirection: 'row',
    gap: 12,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  cardClose: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 30,
    zIndex: 2,
  },
  eventImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 96,
    width: 96,
  },
  eventImageFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  avatarLarge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 48,
    height: 96,
    width: 96,
  },
  avatarFallbackLarge: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  avatarInitialLarge: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
  },
  cardText: {
    flex: 1,
    gap: 6,
    paddingRight: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  eventBadge: {
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  privateBadge: {
    backgroundColor: '#ede9fe',
  },
  eventBadgeText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  privateBadgeText: {
    color: '#6d28d9',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  detailsButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
