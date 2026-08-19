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
import QRCode from 'react-native-qrcode-svg';

import {
  formatBackupCode,
  formatCurrency,
  getEventDetail,
  getTicketQrValue,
  purchaseTicket,
  type EventDetail,
  type PaymentMethod,
  type TicketRow,
} from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';

type CheckoutStep = 'selecao' | 'confirmacao' | 'pagamento' | 'concluido';

const MOCK_METHODS: { id: PaymentMethod; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { id: 'mock_pix', icon: 'qrcode', label: 'Pix mock' },
  { id: 'mock_card', icon: 'credit-card-outline', label: 'Cartao mock' },
];

export default function EventCheckoutScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('selecao');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mock_pix');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paying, setPaying] = useState(false);
  const [ticket, setTicket] = useState<TicketRow | null>(null);

  const loadDetail = useCallback(async () => {
    if (!user?.id || !eventoId) {
      return;
    }

    setLoading(true);

    try {
      setDetail(await getEventDetail(eventoId, user.id, profile));
    } catch (error) {
      Alert.alert('Erro no checkout', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [eventoId, profile, user?.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handlePayment() {
    if (!eventoId || !user?.id) {
      return;
    }

    setPaying(true);

    try {
      const nextTicket = await purchaseTicket(eventoId, user.id, profile, {
        acceptedTerms,
        paymentMethod,
      });

      setTicket(nextTicket);
      setStep('concluido');
    } catch (error) {
      Alert.alert('Pagamento nao concluido', error instanceof Error ? error.message : String(error));
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando checkout...</Text>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Evento indisponivel para compra.</Text>
      </SafeAreaView>
    );
  }

  const { event } = detail;
  const serviceFee = event.precoIngresso > 0 ? Math.max(1.5, event.precoIngresso * 0.05) : 0;
  const total = event.precoIngresso + serviceFee;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.topText}>
            <Text style={styles.title}>Comprar ingresso</Text>
            <Text style={styles.subtitle}>{event.titulo}</Text>
          </View>
        </View>

        <View style={styles.eventCard}>
          {event.capaUrl ? (
            <Image source={{ uri: event.capaUrl }} style={styles.eventImage} />
          ) : (
            <View style={styles.eventFallback}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={30} color="#ef4444" />
            </View>
          )}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{event.titulo}</Text>
            <Text style={styles.eventMeta}>
              {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
            </Text>
            <Text style={styles.eventMeta}>{event.localNome || 'Local a definir'}</Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <StepPill active={step === 'selecao'} done={step !== 'selecao'} label="Selecao" />
          <StepPill active={step === 'confirmacao'} done={step === 'pagamento' || step === 'concluido'} label="Confirmacao" />
          <StepPill active={step === 'pagamento'} done={step === 'concluido'} label="Pagamento" />
        </View>

        {step === 'selecao' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingresso</Text>
            <View style={styles.ticketOption}>
              <View style={styles.ticketIcon}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={23} color="#ef4444" />
              </View>
              <View style={styles.ticketOptionText}>
                <Text style={styles.ticketOptionTitle}>Ingresso individual</Text>
                <Text style={styles.ticketOptionMeta}>Quantidade 1</Text>
              </View>
              <Text style={styles.ticketOptionPrice}>{formatCurrency(event.precoIngresso)}</Text>
            </View>

            <Pressable
              style={[styles.primaryButton, !detail.canBuyTicket && styles.disabledButton]}
              onPress={() => setStep('confirmacao')}
              disabled={!detail.canBuyTicket}
            >
              <MaterialCommunityIcons name="arrow-right" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>
                {detail.canBuyTicket ? 'Continuar' : detail.ageGateMessage ?? 'Indisponivel'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'confirmacao' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmacao</Text>
            <View style={styles.summaryBox}>
              <SummaryLine label="Ingresso" value={formatCurrency(event.precoIngresso)} />
              <SummaryLine label="Taxa mock" value={formatCurrency(serviceFee)} />
              <View style={styles.summaryDivider} />
              <SummaryLine label="Total" value={formatCurrency(total)} strong />
            </View>

            <Pressable
              style={[styles.termsRow, acceptedTerms && styles.termsRowActive]}
              onPress={() => setAcceptedTerms((current) => !current)}
            >
              <MaterialCommunityIcons
                name={acceptedTerms ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={22}
                color={acceptedTerms ? '#0f766e' : '#64748b'}
              />
              <Text style={styles.termsText}>Confirmo os dados do evento e a classificacao etaria.</Text>
            </Pressable>

            <View style={styles.dualActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setStep('selecao')}>
                <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !acceptedTerms && styles.disabledButton]}
                onPress={() => setStep('pagamento')}
                disabled={!acceptedTerms}
              >
                <MaterialCommunityIcons name="shield-check-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 'pagamento' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pagamento</Text>
            <View style={styles.paymentGrid}>
              {MOCK_METHODS.map((method) => (
                <Pressable
                  key={method.id}
                  style={[styles.paymentOption, paymentMethod === method.id && styles.paymentOptionActive]}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <MaterialCommunityIcons
                    name={method.icon}
                    size={24}
                    color={paymentMethod === method.id ? '#ffffff' : '#0f172a'}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMethod === method.id && styles.paymentOptionTextActive,
                    ]}
                  >
                    {method.label}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.paymentOptionDisabled}>
                <MaterialCommunityIcons name="credit-card-lock-outline" size={24} color="#94a3b8" />
                <Text style={styles.paymentOptionDisabledText}>Stripe em breve</Text>
              </View>
            </View>

            <View style={styles.dualActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setStep('confirmacao')} disabled={paying}>
                <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handlePayment} disabled={paying}>
                {paying ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <MaterialCommunityIcons name="cash-check" size={20} color="#ffffff" />
                )}
                <Text style={styles.primaryButtonText}>Pagar {formatCurrency(total)}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 'concluido' && ticket ? (
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons name="check" size={28} color="#ffffff" />
            </View>
            <Text style={styles.successTitle}>Ingresso ativo</Text>
            <View style={styles.qrWrap}>
              <QRCode backgroundColor="#ffffff" color="#0f172a" size={180} value={getTicketQrValue(ticket)} />
            </View>
            <Text style={styles.backupLabel}>Codigo de backup</Text>
            <Text style={styles.backupCode}>{formatBackupCode(ticket.codigo)}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.replace({
                  pathname: '/ingressos/index',
                })
              }
            >
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Meus ingressos</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepPill({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={[styles.stepPill, active && styles.stepPillActive, done && styles.stepPillDone]}>
      <Text style={[styles.stepPillText, (active || done) && styles.stepPillTextActive]}>{label}</Text>
    </View>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
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
    gap: 20,
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
  eventCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 96,
    padding: 10,
  },
  eventImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 76,
    width: 76,
  },
  eventFallback: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  eventInfo: {
    flex: 1,
    gap: 4,
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
  stepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepPill: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepPillActive: {
    backgroundColor: '#0f766e',
  },
  stepPillDone: {
    backgroundColor: '#134e4a',
  },
  stepPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepPillTextActive: {
    color: '#ffffff',
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  ticketOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 12,
  },
  ticketIcon: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ticketOptionText: {
    flex: 1,
    gap: 3,
  },
  ticketOptionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  ticketOptionMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  ticketOptionPrice: {
    color: '#0f766e',
    fontSize: 16,
    fontWeight: '900',
  },
  summaryBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  summaryLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  summaryStrong: {
    color: '#0f172a',
    fontSize: 18,
  },
  summaryDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
  },
  termsRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 12,
  },
  termsRowActive: {
    borderColor: '#0f766e',
  },
  termsText: {
    color: '#334155',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    minHeight: 92,
    justifyContent: 'center',
    padding: 12,
  },
  paymentOptionActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  paymentOptionText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  paymentOptionTextActive: {
    color: '#ffffff',
  },
  paymentOptionDisabled: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    minHeight: 92,
    justifyContent: 'center',
    padding: 12,
  },
  paymentOptionDisabledText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  dualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  primaryButtonText: {
    color: '#ffffff',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  successBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  successTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  qrWrap: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
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
});
