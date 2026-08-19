import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import QRCode from 'react-native-qrcode-svg';

import {
  formatBackupCode,
  formatCurrency,
  getMyTickets,
  getTicketQrValue,
  getTicketStatusLabel,
  type StatusIngresso,
  type TicketWithEvent,
} from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

const STATUS_COLORS: Record<StatusIngresso, { bg: string; color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  cancelado: { bg: '#fee2e2', color: '#991b1b', icon: 'ticket-outline' },
  pago: { bg: '#dcfce7', color: '#166534', icon: 'ticket-confirmation-outline' },
  reservado: { bg: '#fef3c7', color: '#92400e', icon: 'ticket-outline' },
  usado: { bg: '#e0f2fe', color: '#075985', icon: 'ticket-account' },
};

export default function MyTicketsScreen() {
  const user = useAuthStore((state) => state.user);
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);

    try {
      setTickets(await getMyTickets(user.id));
    } catch (error) {
      Alert.alert('Erro ao carregar ingressos', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await loadTickets();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando ingressos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.topText}>
            <Text style={styles.title}>Meus ingressos</Text>
            <Text style={styles.subtitle}>{tickets.length} ingresso{tickets.length === 1 ? '' : 's'}</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color="#0f172a" />
            )}
          </Pressable>
        </View>

        {tickets.length ? (
          tickets.map((item) => <TicketCard item={item} key={item.ticket.id} />)
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="ticket-outline" size={34} color="#ef4444" />
            <Text style={styles.emptyTitle}>Nenhum ingresso</Text>
            <Text style={styles.emptyText}>Os ingressos comprados aparecem aqui.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TicketCard({ item }: { item: TicketWithEvent }) {
  const { ticket, event } = item;
  const status = STATUS_COLORS[ticket.status];
  const isCanceled = ticket.status === 'cancelado';

  return (
    <View style={[styles.ticketCard, isCanceled && styles.ticketCardMuted]}>
      <View style={styles.eventHeader}>
        {event?.capaUrl ? (
          <Image source={{ uri: event.capaUrl }} style={styles.eventImage} />
        ) : (
          <View style={styles.eventFallback}>
            <MaterialCommunityIcons name="party-popper" size={24} color="#ef4444" />
          </View>
        )}
        <View style={styles.eventText}>
          <Text style={styles.eventTitle}>{event?.titulo ?? 'Evento indisponivel'}</Text>
          <Text style={styles.eventMeta}>
            {event?.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
          </Text>
          <Text style={styles.eventMeta}>{event?.localNome || 'Local a definir'}</Text>
        </View>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
        <MaterialCommunityIcons name={status.icon} size={18} color={status.color} />
        <Text style={[styles.statusText, { color: status.color }]}>{getTicketStatusLabel(ticket.status)}</Text>
      </View>

      <View style={styles.qrArea}>
        <View style={[styles.qrWrap, isCanceled && styles.qrMuted]}>
          <QRCode
            backgroundColor="#ffffff"
            color={isCanceled ? '#94a3b8' : '#0f172a'}
            size={170}
            value={getTicketQrValue(ticket)}
          />
        </View>
        <View style={styles.backupBox}>
          <Text style={styles.backupLabel}>Codigo de backup</Text>
          <Text style={styles.backupCode}>{formatBackupCode(ticket.codigo)}</Text>
          <Text style={styles.ticketMeta}>Valor: {formatCurrency(Number(ticket.valor_pago ?? 0))}</Text>
        </View>
      </View>

      {event ? (
        <Pressable
          style={styles.detailButton}
          onPress={() =>
            router.push({
              pathname: '/eventos/[eventoId]/index',
              params: { eventoId: event.id },
            })
          }
        >
          <MaterialCommunityIcons name="calendar-search" size={19} color="#0f172a" />
          <Text style={styles.detailButtonText}>Ver evento</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    gap: 16,
    paddingBottom: 34,
    paddingTop: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
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
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  topText: {
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
    fontWeight: '700',
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  ticketCardMuted: {
    opacity: 0.78,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  eventImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 70,
    width: 70,
  },
  eventFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  eventText: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '900',
  },
  qrArea: {
    alignItems: 'center',
    gap: 14,
  },
  qrWrap: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  qrMuted: {
    backgroundColor: '#f1f5f9',
  },
  backupBox: {
    alignItems: 'center',
    gap: 5,
  },
  backupLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  backupCode: {
    color: '#0f766e',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  ticketMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  detailButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  detailButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 24,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
  },
});
