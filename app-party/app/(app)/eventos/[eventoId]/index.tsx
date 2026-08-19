import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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

import { EventMapPreview } from '@/components/EventMapPreview';
import {
  formatBackupCode,
  formatCurrency,
  getEventDetail,
  getTicketStatusLabel,
  type EventDetail,
} from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

export default function EventDetailScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !eventoId) {
      return;
    }

    setLoading(true);

    try {
      setDetail(await getEventDetail(eventoId, user.id, profile));
    } catch (error) {
      Alert.alert('Erro ao carregar evento', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [eventoId, profile, user?.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando evento...</Text>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Evento nao encontrado.</Text>
      </SafeAreaView>
    );
  }

  const { event } = detail;
  const canOpenSocial =
    detail.isOrganizer ||
    detail.currentTicket?.status === 'pago' ||
    detail.currentTicket?.status === 'usado';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          {detail.isOrganizer ? (
            <Pressable
              style={styles.manageButton}
              onPress={() =>
                router.push({
                  pathname: '/eventos/[eventoId]/gerenciar',
                  params: { eventoId: event.id },
                })
              }
            >
              <MaterialCommunityIcons name="cog-outline" size={18} color="#0f172a" />
              <Text style={styles.manageButtonText}>Gerenciar</Text>
            </Pressable>
          ) : null}
        </View>

        {event.capaUrl ? (
          <Image source={{ uri: event.capaUrl }} style={styles.cover} />
        ) : (
          <View style={styles.coverFallback}>
            <MaterialCommunityIcons name="party-popper" size={42} color="#ef4444" />
          </View>
        )}

        <View style={styles.titleBlock}>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{event.tipo === 'privado' ? 'Privado' : 'Publico'}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {event.classificacaoEtaria === 0 ? 'Livre' : `${event.classificacaoEtaria}+`}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{event.titulo}</Text>
          <Text style={styles.meta}>
            {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
          </Text>
        </View>

        <View style={styles.infoGrid}>
          <InfoCell label="Ingresso" value={formatCurrency(event.precoIngresso)} />
          <InfoCell
            label="Capacidade"
            value={`${detail.participantCount}/${event.capacidade ?? 'sem limite'}`}
          />
          <InfoCell label="Status" value={event.status === 'ativo' ? 'Ativo' : 'Cancelado'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          <Text style={styles.description}>{event.descricao}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mapa</Text>
          <EventMapPreview
            latitude={event.latitude}
            longitude={event.longitude}
            title={event.localNome}
            address={event.endereco}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participantes visiveis</Text>
          {detail.participants.length ? (
            detail.participants.slice(0, 20).map((participant) => (
              <View style={styles.participantRow} key={participant.usuarioId}>
                {participant.perfil?.fotoUrl ? (
                  <Image source={{ uri: participant.perfil.fotoUrl }} style={styles.participantAvatar} />
                ) : (
                  <View style={styles.participantFallback}>
                    <Text style={styles.participantInitial}>
                      {(participant.perfil?.nome ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.participantText}>
                  <Text style={styles.participantName}>
                    {participant.perfil?.nome ?? 'Participante'}
                  </Text>
                  <Text style={styles.participantMeta}>
                    @{participant.perfil?.username || 'semusername'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum participante visivel ainda.</Text>
          )}
        </View>

        {canOpenSocial ? (
          <Pressable
            style={styles.communityButton}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/social',
                params: { eventoId: event.id },
              })
            }
          >
            <MaterialCommunityIcons name="message-text-outline" size={20} color="#ffffff" />
            <Text style={styles.communityButtonText}>Comunidade do evento</Text>
          </Pressable>
        ) : null}

        {detail.currentTicket ? (
          <View style={styles.ticketBox}>
            <Text style={styles.ticketTitle}>Seu ingresso</Text>
            <Text style={styles.ticketCode}>{formatBackupCode(detail.currentTicket.codigo)}</Text>
            <Text style={styles.ticketMeta}>
              Status: {getTicketStatusLabel(detail.currentTicket.status)}
            </Text>
            <Pressable
              style={styles.myTicketsButton}
              onPress={() =>
                router.push({
                  pathname: '/ingressos/index',
                })
              }
            >
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={19} color="#0f172a" />
              <Text style={styles.myTicketsButtonText}>Meus ingressos</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.buyButton, !detail.canBuyTicket && styles.buyButtonDisabled]}
            onPress={() =>
              router.push({
                pathname: '/eventos/[eventoId]/comprar',
                params: { eventoId: event.id },
              })
            }
            disabled={!detail.canBuyTicket}
          >
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#ffffff" />
            <Text style={styles.buyButtonText}>
              {detail.canBuyTicket ? 'Comprar ingresso' : detail.ageGateMessage ?? 'Indisponivel'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  manageButton: {
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
  manageButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  cover: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 200,
    width: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 200,
    justifyContent: 'center',
    width: '100%',
  },
  titleBlock: {
    gap: 10,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
  },
  meta: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCell: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 74,
    justifyContent: 'center',
    padding: 10,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  participantRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    padding: 10,
  },
  participantAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  participantFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  participantInitial: {
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
  buyButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  buyButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  communityButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  communityButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  ticketBox: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  ticketTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  ticketCode: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
  },
  ticketMeta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  myTicketsButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
  },
  myTicketsButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
});
