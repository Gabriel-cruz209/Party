import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type EventMapPreviewProps = {
  latitude: number | null;
  longitude: number | null;
  title: string;
  address: string;
};

export function EventMapPreview({ latitude, longitude, title, address }: EventMapPreviewProps) {
  function openMaps() {
    if (latitude === null || longitude === null) {
      return;
    }

    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  }

  return (
    <Pressable style={styles.container} onPress={openMaps}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="map-marker" size={24} color="#ef4444" />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address || 'Endereco nao informado'}</Text>
        {latitude !== null && longitude !== null ? (
          <Text style={styles.coords}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="open-in-new" size={18} color="#64748b" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  textGroup: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  address: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 19,
  },
  coords: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
});
