import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type EventMapPreviewProps = {
  latitude: number | null;
  longitude: number | null;
  title: string;
  address: string;
};

export function EventMapPreview({ latitude, longitude, title, address }: EventMapPreviewProps) {
  if (latitude === null || longitude === null) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address || 'Endereco nao informado'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        pointerEvents="none"
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        }}
        style={styles.map}
      >
        <Marker coordinate={{ latitude, longitude }} title={title} description={address} />
      </MapView>
      <View style={styles.caption}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address || 'Endereco nao informado'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    height: 180,
    width: '100%',
  },
  caption: {
    gap: 4,
    padding: 12,
  },
  fallback: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
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
});
