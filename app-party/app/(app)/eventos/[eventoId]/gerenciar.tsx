import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { EventForm } from '@/components/EventForm';
import {
  cancelEvent,
  formatBackupCode,
  formatCurrency,
  getOrganizerEventDetail,
  getTicketStatusLabel,
  updateEvent,
  type EventDetail,
  type EventFormInput,
  type EventParticipant,
} from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

export default function EventManagementScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !eventoId) {
      return;
    }

    setLoading(true);

    try {
      setDetail(await getOrganizerEventDetail(eventoId, user.id, profile));
    } catch (error) {
      Alert.alert('Erro ao carregar gestao', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [eventoId, profile, user?.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const paidTickets = useMemo(
    () => detail?.participants.filter((participant) => participant.ingresso?.status === 'pago').length ?? 0,
    [detail?.participants],
  );
  const usedTickets = useMemo(
    () => detail?.participants.filter((participant) => participant.ingresso?.status === 'usado').length ?? 0,
    [detail?.participants],
  );

  async function handleSave(input: EventFormInput) {
    if (!eventoId) {
      return;
    }

    setSaving(true);

    try {
      const updatedEvent = await updateEvent(eventoId, profile, input);
      setDetail((current) => (current ? { ...current, event: updatedEvent } : current));
      setEditing(false);
      await loadDetail();
    } catch (error) {
      Alert.alert('Erro ao editar evento', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmCancelEvent() {
    if (!eventoId || detail?.event.status === 'cancelado') {
      return;
    }

    Alert.alert(
      'Cancelar evento',
      'O evento ficara indisponivel para compra e aparecera como cancelado para quem ja tinha ingresso.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar evento',
          style: 'destructive',
          onPress: () => {
            void handleCancelEvent();
          },
        },
      ],
    );
  }

  async function handleCancelEvent() {
    if (!eventoId) {
      return;
    }

    setCanceling(true);

    try {
      await cancelEvent(eventoId);
      await loadDetail();
      setEditing(false);
    } catch (error) {
      Alert.alert('Erro ao cancelar evento', error instanceof Error ? error.message : String(error));
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando gestao do evento...</Text>
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

  const { event } = detail;
  const isCanceled = event.status === 'cancelado';

  if (editing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setEditing(false)}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Editar evento</Text>
            <Text style={styles.subtitle}>Atualize dados, mapa, capa e regras do ingresso.</Text>
          </View>
        </View>
        <EventForm
          initialEvent={event}
          submitLabel="Salvar evento"
          loading={saving}
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
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
          <Pressable
            style={styles.detailButton}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/index',
                params: { eventoId: event.id },
              })
            }
          >
            <MaterialCommunityIcons name="eye-outline" size={18} color="#0f172a" />
            <Text style={styles.detailButtonText}>Ver detalhe</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          {event.capaUrl ? (
            <Image source={{ uri: event.capaUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <MaterialCommunityIcons name="calendar-star" size={36} color="#ef4444" />
            </View>
          )}
          <View style={styles.heroText}>
            <View style={[styles.statusBadge, isCanceled && styles.statusBadgeCanceled]}>
              <Text style={[styles.statusBadgeText, isCanceled && styles.statusBadgeTextCanceled]}>
                {isCanceled ? 'Cancelado' : 'Ativo'}
              </Text>
            </View>
            <Text style={styles.eventTitle}>{event.titulo}</Text>
            <Text style={styles.eventMeta}>
              {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Sem data'}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Participantes" value={`${detail.participantCount}/${event.capacidade ?? 'sem limite'}`} />
          <Stat label="Pagos" value={String(paidTickets)} />
          <Stat label="Usados" value={String(usedTickets)} />
          <Stat label="Receita" value={formatCurrency(detail.participantCount * event.precoIngresso)} />
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            style={[styles.actionButton, isCanceled && styles.actionButtonDisabled]}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/scanner',
                params: { eventoId: event.id },
              })
            }
            disabled={isCanceled}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={21} color="#ffffff" />
            <Text style={styles.actionButtonText}>Scanner QR</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryAction, isCanceled && styles.actionButtonDisabledLight]}
            onPress={() => setEditing(true)}
            disabled={isCanceled}
          >
            <MaterialCommunityIcons name="pencil-outline" size={21} color="#0f172a" />
            <Text style={styles.secondaryActionText}>Editar</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryAction}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/social',
                params: { eventoId: event.id },
              })
            }
          >
            <MaterialCommunityIcons name="message-text-outline" size={21} color="#0f172a" />
            <Text style={styles.secondaryActionText}>Comunidade</Text>
          </Pressable>

          <Pressable
            style={[styles.dangerAction, isCanceled && styles.actionButtonDisabledLight]}
            onPress={confirmCancelEvent}
            disabled={isCanceled || canceling}
          >
            {canceling ? (
              <ActivityIndicator color="#991b1b" />
            ) : (
              <MaterialCommunityIcons name="calendar-remove-outline" size={21} color="#991b1b" />
            )}
            <Text style={styles.dangerActionText}>{isCanceled ? 'Cancelado' : 'Cancelar'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Participantes</Text>
            <Text style={styles.sectionCount}>{detail.participants.length}</Text>
          </View>

          {detail.participants.length ? (
            detail.participants.map((participant) => (
              <ParticipantRow key={participant.usuarioId} participant={participant} />
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum participante confirmou presenca ainda.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ParticipantRow({ participant }: { participant: EventParticipant }) {
  const status = participant.ingresso?.status ?? 'sem ingresso';
  const statusColor =
    status === 'usado'
      ? '#0f766e'
      : status === 'pago'
        ? '#2563eb'
        : status === 'cancelado'
          ? '#991b1b'
          : '#64748b';
  const statusLabel = participant.ingresso
    ? getTicketStatusLabel(participant.ingresso.status)
    : 'Sem ingresso';

  return (
    <View style={styles.participantRow}>
      {participant.perfil?.fotoUrl ? (
        <Image source={{ uri: participant.perfil.fotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>
            {(participant.perfil?.nome ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.participantText}>
        <Text style={styles.participantName}>{participant.perfil?.nome ?? 'Participante'}</Text>
        <Text style={styles.participantMeta}>@{participant.perfil?.username || 'semusername'}</Text>
        {participant.ingresso?.codigo ? (
          <Text style={styles.ticketCode} numberOfLines={1}>
            {formatBackupCode(participant.ingresso.codigo)}
          </Text>
        ) : null}
      </View>

      <View style={styles.ticketStatus}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.ticketStatusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
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
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    gap: 20,
    paddingBottom: 34,
    paddingTop: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  detailButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  detailButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
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
    lineHeight: 21,
  },
  hero: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroImage: {
    backgroundColor: '#e2e8f0',
    height: 150,
    width: '100%',
  },
  heroFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    height: 150,
    justifyContent: 'center',
    width: '100%',
  },
  heroText: {
    gap: 8,
    padding: 14,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeCanceled: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  statusBadgeTextCanceled: {
    color: '#991b1b',
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    minHeight: 78,
    justifyContent: 'center',
    padding: 12,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  actionButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionButtonDisabledLight: {
    opacity: 0.56,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  dangerAction: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  dangerActionText: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '900',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '900',
  },
  participantRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    padding: 10,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 23,
    height: 46,
    width: 46,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  participantText: {
    flex: 1,
    gap: 2,
  },
  participantName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  participantMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  ticketCode: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
    maxWidth: '98%',
  },
  ticketStatus: {
    alignItems: 'center',
    gap: 5,
    minWidth: 66,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
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
