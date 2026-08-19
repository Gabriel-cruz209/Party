import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';

import type { EventLocation } from '@/services/event.service';

type MapPickerProps = {
  value: EventLocation;
  onChange: (location: EventLocation) => void;
};

export function MapPicker({ value, onChange }: MapPickerProps) {
  const [query, setQuery] = useState(value.endereco || value.nome);
  const [loading, setLoading] = useState(false);

  const region = useMemo(
    () => ({
      latitude: value.latitude,
      longitude: value.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }),
    [value.latitude, value.longitude],
  );

  useEffect(() => {
    async function hydrateLocation() {
      if (value.latitude !== 0 || value.longitude !== 0) {
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      onChange({
        ...value,
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    }

    void hydrateLocation();
  }, [onChange, value]);

  async function updateAddress(latitude: number, longitude: number) {
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const formatted = [address?.street, address?.streetNumber, address?.city, address?.region]
        .filter(Boolean)
        .join(', ');

      onChange({
        ...value,
        endereco: formatted || value.endereco,
        latitude,
        longitude,
      });
      setQuery(formatted || query);
    } catch {
      onChange({
        ...value,
        latitude,
        longitude,
      });
    }
  }

  async function geocode() {
    if (!query.trim()) {
      return;
    }

    setLoading(true);

    try {
      const result = await Location.geocodeAsync(query.trim());
      const first = result[0];

      if (first) {
        onChange({
          ...value,
          endereco: query.trim(),
          latitude: first.latitude,
          longitude: first.longitude,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    void updateAddress(latitude, longitude);
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar endereco"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        <Pressable style={styles.searchButton} onPress={geocode} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <MaterialCommunityIcons name="magnify" size={22} color="#ffffff" />
          )}
        </Pressable>
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        region={region}
        onPress={handleMapPress}
        style={styles.map}
      >
        <Marker coordinate={{ latitude: value.latitude, longitude: value.longitude }} />
      </MapView>

      <Text style={styles.hint}>Toque no mapa para definir o ponto do evento.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 52,
  },
  map: {
    borderRadius: 8,
    height: 220,
    overflow: 'hidden',
    width: '100%',
  },
  hint: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
});
