import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarCodeScanner, type BarCodeScannerResult } from 'expo-barcode-scanner';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getOrganizerEventDetail, validateTicketCode, type EventDetail } from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

export default function EventScannerScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [permission, requestPermission] = BarCodeScanner.usePermissions();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [backupCode, setBackupCode] = useState('');
  const [lastResult, setLastResult] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !eventoId) {
      return;
    }

    setLoading(true);

    try {
      setDetail(await getOrganizerEventDetail(eventoId, user.id, profile));
    } catch (error) {
      Alert.alert('Erro no scanner', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [eventoId, profile, user?.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function validateScannedData(data: string) {
    if (!eventoId || processing || !scannerActive) {
      return;
    }

    if (!data.trim()) {
      setLastResult({ status: 'error', message: 'Informe ou escaneie um codigo valido.' });
      return;
    }

    setProcessing(true);
    setScannerActive(false);

    try {
      const ticket = await validateTicketCode(eventoId, data);
      setLastResult({
        status: 'ok',
        message: `Ingresso validado: ${ticket.codigo}`,
      });
      setBackupCode('');
      await loadDetail();
    } catch (error) {
      setLastResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleBarcodeScanned(result: BarCodeScannerResult) {
    void validateScannedData(result.data);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Preparando scanner...</Text>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Evento nao encontrado ou sem permissao.</Text>
      </SafeAreaView>
    );
  }

  const hasPermission = permission?.granted;
  const validatedCount = detail.participants.filter(
    (participant) => participant.ingresso?.status === 'usado',
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Scanner QR</Text>
          <Text style={styles.subtitle}>{detail.event.titulo}</Text>
        </View>
      </View>

      <View style={styles.scannerBox}>
        {hasPermission ? (
          <>
            <BarCodeScanner
              barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
              onBarCodeScanned={scannerActive ? handleBarcodeScanned : undefined}
              style={styles.camera}
            />
            <View pointerEvents="none" style={styles.scanFrame}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </>
        ) : (
          <View style={styles.permissionBox}>
            <MaterialCommunityIcons name="camera-outline" size={38} color="#ffffff" />
            <Text style={styles.permissionTitle}>Permissao da camera</Text>
            <Text style={styles.permissionText}>
              Autorize a camera para validar ingressos pelo QR Code.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color="#0f172a" />
              <Text style={styles.permissionButtonText}>Autorizar camera</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.metricRow}>
          <Metric label="Participantes" value={String(detail.participantCount)} />
          <Metric label="Validados" value={String(validatedCount)} />
        </View>

        {processing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator color="#ef4444" />
            <Text style={styles.processingText}>Validando ingresso...</Text>
          </View>
        ) : null}

        <View style={styles.manualBox}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!processing}
            onChangeText={setBackupCode}
            placeholder="Codigo de backup"
            placeholderTextColor="#94a3b8"
            style={styles.manualInput}
            value={backupCode}
          />
          <Pressable
            style={styles.manualButton}
            onPress={() => {
              void validateScannedData(backupCode);
            }}
            disabled={processing}
          >
            <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {lastResult ? (
          <View style={[styles.resultBox, lastResult.status === 'ok' ? styles.resultOk : styles.resultError]}>
            <MaterialCommunityIcons
              name={lastResult.status === 'ok' ? 'check-circle-outline' : 'alert-circle-outline'}
              size={22}
              color={lastResult.status === 'ok' ? '#166534' : '#991b1b'}
            />
            <Text
              style={[styles.resultText, lastResult.status === 'ok' ? styles.resultTextOk : styles.resultTextError]}
            >
              {lastResult.message}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.scanAgainButton, !hasPermission && styles.scanAgainButtonDisabled]}
          onPress={() => {
            setLastResult(null);
            setScannerActive(true);
          }}
          disabled={!hasPermission || processing}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="#ffffff" />
          <Text style={styles.scanAgainButtonText}>Ler proximo QR</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.18)',
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
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
  },
  scannerBox: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    maxHeight: 560,
    minHeight: 360,
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  scanFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTopLeft: {
    borderColor: '#ffffff',
    borderLeftWidth: 5,
    borderTopWidth: 5,
    height: 78,
    left: '18%',
    position: 'absolute',
    top: '27%',
    width: 78,
  },
  cornerTopRight: {
    borderColor: '#ffffff',
    borderRightWidth: 5,
    borderTopWidth: 5,
    height: 78,
    position: 'absolute',
    right: '18%',
    top: '27%',
    width: 78,
  },
  cornerBottomLeft: {
    borderBottomWidth: 5,
    borderColor: '#ffffff',
    borderLeftWidth: 5,
    bottom: '27%',
    height: 78,
    left: '18%',
    position: 'absolute',
    width: 78,
  },
  cornerBottomRight: {
    borderBottomWidth: 5,
    borderColor: '#ffffff',
    borderRightWidth: 5,
    bottom: '27%',
    height: 78,
    position: 'absolute',
    right: '18%',
    width: 78,
  },
  permissionBox: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  permissionText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  permissionButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  statusPanel: {
    gap: 12,
    paddingBottom: 30,
    paddingTop: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBox: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 70,
    justifyContent: 'center',
    padding: 12,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  processingBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  processingText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  manualBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  manualInput: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  manualButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  resultBox: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 12,
  },
  resultOk: {
    backgroundColor: '#dcfce7',
  },
  resultError: {
    backgroundColor: '#fee2e2',
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  resultTextOk: {
    color: '#166534',
  },
  resultTextError: {
    color: '#991b1b',
  },
  scanAgainButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  scanAgainButtonDisabled: {
    backgroundColor: '#64748b',
  },
  scanAgainButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
