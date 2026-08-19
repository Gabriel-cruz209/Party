import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { EventLocation } from '@/services/event.service';

type MapPickerProps = {
  value: EventLocation;
  onChange: (location: EventLocation) => void;
};

export function MapPicker({ value, onChange }: MapPickerProps) {
  const [query, setQuery] = useState(value.endereco || value.nome);
  const [loading, setLoading] = useState(false);

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

  return (
    <View style={styles.container}>
      <Text style={styles.mapFallbackTitle}>Local do evento</Text>
      <Text style={styles.mapFallbackText}>
        No web, use a busca por endereco. No celular, o mapa interativo abre com toque no mapa.
      </Text>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rua, numero, cidade"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        <Pressable style={styles.button} onPress={geocode} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Buscar</Text>}
        </Pressable>
      </View>
      <Text style={styles.coords}>
        {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  mapFallbackTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  mapFallbackText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 86,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  coords: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
