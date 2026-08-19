import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { formatCurrency } from '@/services/event.service';
import {
  getOrganizerDashboard,
  saveCompanyProfile,
  type CompanyMutationInput,
  type CompanyProfile,
  type CompanyType,
  type OrganizerDashboard,
  type OrganizerEventSummary,
} from '@/services/organizer.service';
import type { ProfileMutationInput, SocialLinkKey } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';

type ProfileScreenProps = {
  audience: 'pessoal' | 'empresa';
};

const LINK_LABELS: Record<SocialLinkKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  site: 'Site',
};

const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  bar: 'Bar',
  casa_de_eventos: 'Casa de eventos',
  casa_de_show: 'Casa de show',
  clube: 'Clube',
  outro: 'Outro',
};

export function ProfileScreen({ audience }: ProfileScreenProps) {
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const status = useAuthStore((state) => state.status);
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const [editing, setEditing] = useState(false);
  const [dashboard, setDashboard] = useState<OrganizerDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [companyEditing, setCompanyEditing] = useState(false);
  const [companyDraft, setCompanyDraft] = useState<CompanyMutationInput>({
    cnpj: '',
    descricao: '',
    endereco: '',
    nomeFantasia: '',
    site: '',
    telefone: '',
    tipoLocal: 'casa_de_eventos',
  });
  const [savingCompany, setSavingCompany] = useState(false);

  const isBusinessRoute = audience === 'empresa';
  const isBusy = status === 'loading';
  const socialEntries = Object.entries(profile?.linksSociais ?? {}).filter(([, value]) =>
    Boolean(value),
  ) as [SocialLinkKey, string][];

  const loadDashboard = useCallback(async () => {
    if (!profile || profile.tipo !== 'empresa') {
      setDashboard(null);
      return;
    }

    setDashboardLoading(true);

    try {
      const nextDashboard = await getOrganizerDashboard(profile);

      setDashboard(nextDashboard);
      setCompanyDraft(companyToDraft(nextDashboard.company, profile.nome, profile.bio));
    } catch (error) {
      Alert.alert('Erro no dashboard', error instanceof Error ? error.message : String(error));
    } finally {
      setDashboardLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleSave(values: ProfileMutationInput) {
    try {
      await updateProfile(values);
      setEditing(false);
      await loadDashboard();
    } catch (error) {
      Alert.alert('Erro ao salvar perfil', error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveCompany() {
    if (!profile) {
      return;
    }

    setSavingCompany(true);

    try {
      await saveCompanyProfile(profile, companyDraft);
      setCompanyEditing(false);
      await loadDashboard();
    } catch (error) {
      Alert.alert('Erro nos dados da empresa', error instanceof Error ? error.message : String(error));
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Erro ao sair', error instanceof Error ? error.message : String(error));
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.editHeader}>
          <Text style={styles.editTitle}>Editar perfil</Text>
          <Text style={styles.editSubtitle}>
            {isBusinessRoute ? 'Dados da presenca empresarial' : 'Dados do seu perfil social'}
          </Text>
        </View>
        <ProfileForm
          initialProfile={profile}
          submitLabel="Salvar perfil"
          loading={isBusy}
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {profile.fotoUrl ? (
              <Image source={{ uri: profile.fotoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{profile.nome.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={styles.identity}>
            <View style={styles.badge}>
              <MaterialCommunityIcons
                name={profile.tipo === 'empresa' ? 'office-building-outline' : 'account-outline'}
                size={16}
                color="#0f766e"
              />
              <Text style={styles.badgeText}>{profile.tipo === 'empresa' ? 'Empresa' : 'Pessoal'}</Text>
            </View>
            <Text style={styles.name}>{profile.nome}</Text>
            <Text style={styles.username}>@{profile.username || 'semusername'}</Text>
            <Text style={styles.bio}>
              {profile.bio ||
                (profile.tipo === 'empresa'
                  ? 'Perfil empresarial pronto para criar experiencias.'
                  : 'Perfil pessoal pronto para descobrir eventos.')}
            </Text>
          </View>
        </View>

        <View style={styles.socialActions}>
          <Link href="/criar-evento" asChild>
            <Pressable style={styles.socialButton}>
              <MaterialCommunityIcons name="calendar-plus" size={20} color="#ffffff" />
              <Text style={styles.socialButtonText}>Evento</Text>
            </Pressable>
          </Link>

          <Link href="/feed" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Feed</Text>
            </Pressable>
          </Link>

          <Link href="/mapa" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="map-search-outline" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Mapa</Text>
            </Pressable>
          </Link>

          <Link href="/ingressos/index" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Ingressos</Text>
            </Pressable>
          </Link>

          <Link href="/buscar" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="magnify" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Busca</Text>
            </Pressable>
          </Link>

          <Link href="/amizades" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Amigos</Text>
            </Pressable>
          </Link>

          <Link href="/notificacoes" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="bell-outline" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Notificacoes</Text>
              {unreadNotifications ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
                </View>
              ) : null}
            </Pressable>
          </Link>

          <Link href="/suporte" asChild>
            <Pressable style={styles.socialButtonAlt}>
              <MaterialCommunityIcons name="lifebuoy" size={20} color="#0f172a" />
              <Text style={styles.socialButtonAltText}>Suporte</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{isBusinessRoute ? dashboard?.events.length ?? 0 : 0}</Text>
            <Text style={styles.statLabel}>{isBusinessRoute ? 'eventos' : 'roles'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{isBusinessRoute ? dashboard?.totalTicketsSold ?? 0 : 0}</Text>
            <Text style={styles.statLabel}>{isBusinessRoute ? 'ingressos' : 'amigos'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} numberOfLines={1}>
              {isBusinessRoute ? dashboard?.formattedRevenue ?? 'R$ 0' : 'novo'}
            </Text>
            <Text style={styles.statLabel}>{isBusinessRoute ? 'receita' : 'status'}</Text>
          </View>
        </View>

        {isBusinessRoute ? (
          <BusinessDashboardSection
            dashboard={dashboard}
            draft={companyDraft}
            editing={companyEditing}
            loading={dashboardLoading}
            profileName={profile.nome}
            saving={savingCompany}
            onCancel={() => setCompanyEditing(false)}
            onChange={setCompanyDraft}
            onEdit={() => setCompanyEditing(true)}
            onSave={handleSaveCompany}
          />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redes sociais</Text>
          {socialEntries.length ? (
            <View style={styles.linkList}>
              {socialEntries.map(([key, value]) => (
                <Pressable
                  key={key}
                  style={styles.linkItem}
                  onPress={() => {
                    void Linking.openURL(value);
                  }}
                >
                  <View style={styles.linkIcon}>
                    <MaterialCommunityIcons name="link-variant" size={18} color="#ef4444" />
                  </View>
                  <View style={styles.linkTextGroup}>
                    <Text style={styles.linkLabel}>{LINK_LABELS[key]}</Text>
                    <Text style={styles.linkValue} numberOfLines={1}>
                      {value}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="open-in-new" size={18} color="#64748b" />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nenhuma rede social adicionada ainda.</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => setEditing(true)}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Editar</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleSignOut} disabled={isBusy}>
            {isBusy ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <MaterialCommunityIcons name="logout" size={20} color="#0f172a" />
            )}
            <Text style={styles.secondaryButtonText}>Sair</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function companyToDraft(
  company: CompanyProfile | null,
  profileName: string,
  profileBio: string,
): CompanyMutationInput {
  return {
    cnpj: company?.cnpj ?? '',
    descricao: company?.descricao || profileBio,
    endereco: company?.endereco ?? '',
    nomeFantasia: company?.nomeFantasia || profileName,
    site: company?.site ?? '',
    telefone: company?.telefone ?? '',
    tipoLocal: company?.tipoLocal ?? 'casa_de_eventos',
  };
}

function BusinessDashboardSection({
  dashboard,
  draft,
  editing,
  loading,
  profileName,
  saving,
  onCancel,
  onChange,
  onEdit,
  onSave,
}: {
  dashboard: OrganizerDashboard | null;
  draft: CompanyMutationInput;
  editing: boolean;
  loading: boolean;
  profileName: string;
  saving: boolean;
  onCancel: () => void;
  onChange: (draft: CompanyMutationInput) => void;
  onEdit: () => void;
  onSave: () => Promise<void>;
}) {
  const company = dashboard?.company;
  const completedEvents = dashboard?.completedEvents.slice(0, 8) ?? [];
  const recentEvents = dashboard?.events.slice(0, 5) ?? [];

  function updateDraft(key: keyof CompanyMutationInput, value: string) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Perfil empresa</Text>
          <Pressable style={styles.smallActionButton} onPress={editing ? onCancel : onEdit}>
            <MaterialCommunityIcons name={editing ? 'close' : 'pencil-outline'} size={17} color="#0f172a" />
            <Text style={styles.smallActionText}>{editing ? 'Cancelar' : 'Editar'}</Text>
          </Pressable>
        </View>

        {editing ? (
          <View style={styles.companyEditBox}>
            <CompanyInput label="Nome fantasia" value={draft.nomeFantasia} onChangeText={(value) => updateDraft('nomeFantasia', value)} />
            <CompanyInput label="Descricao" value={draft.descricao ?? ''} multiline onChangeText={(value) => updateDraft('descricao', value)} />
            <CompanyInput label="Endereco" value={draft.endereco ?? ''} onChangeText={(value) => updateDraft('endereco', value)} />
            <CompanyInput label="CNPJ" value={draft.cnpj ?? ''} onChangeText={(value) => updateDraft('cnpj', value)} />
            <CompanyInput label="Telefone" value={draft.telefone ?? ''} onChangeText={(value) => updateDraft('telefone', value)} />
            <CompanyInput label="Site" value={draft.site ?? ''} onChangeText={(value) => updateDraft('site', value)} />

            <View style={styles.companyTypeGrid}>
              {(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.companyTypeButton, draft.tipoLocal === type && styles.companyTypeButtonActive]}
                  onPress={() => onChange({ ...draft, tipoLocal: type })}
                >
                  <Text style={[styles.companyTypeText, draft.tipoLocal === type && styles.companyTypeTextActive]}>
                    {COMPANY_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.companySaveButton} onPress={onSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
              )}
              <Text style={styles.companySaveText}>Salvar empresa</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.companyCard}>
            {loading ? <ActivityIndicator color="#ef4444" /> : null}
            <InfoLine icon="storefront-outline" label="Nome" value={company?.nomeFantasia || profileName} />
            <InfoLine icon="map-marker-outline" label="Endereco" value={company?.endereco || 'Endereco comercial nao informado.'} />
            <InfoLine icon="music-circle-outline" label="Tipo" value={COMPANY_TYPE_LABELS[company?.tipoLocal ?? 'casa_de_eventos']} />
            <InfoLine icon="shield-check-outline" label="Verificacao" value={company?.verificada ? 'Verificada' : 'Nao verificada'} />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dashboard do organizador</Text>
        <View style={styles.dashboardGrid}>
          <MetricBox label="Ingressos" value={String(dashboard?.totalTicketsSold ?? 0)} />
          <MetricBox label="Receita" value={dashboard?.formattedRevenue ?? formatCurrency(0)} />
          <MetricBox label="Participantes" value={String(dashboard?.totalParticipants ?? 0)} />
          <MetricBox label="Posts" value={String(dashboard?.totalPosts ?? 0)} />
        </View>

        {recentEvents.length ? (
          recentEvents.map((item) => <OrganizerEventRow item={item} key={item.event.id} />)
        ) : (
          <Text style={styles.emptyText}>Crie eventos para acompanhar vendas, participantes e posts.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eventos realizados</Text>
        {completedEvents.length ? (
          completedEvents.map((item) => <OrganizerEventRow item={item} key={item.event.id} compact />)
        ) : (
          <Text style={styles.emptyText}>O historico aparece quando seus eventos terminarem.</Text>
        )}
      </View>
    </>
  );
}

function CompanyInput({
  label,
  multiline = false,
  onChangeText,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.companyField}>
      <Text style={styles.companyLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        style={[styles.companyInput, multiline && styles.companyTextArea]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <MaterialCommunityIcons name={icon} size={19} color="#0f766e" />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function OrganizerEventRow({ compact = false, item }: { compact?: boolean; item: OrganizerEventSummary }) {
  return (
    <Pressable
      style={styles.organizerEventRow}
      onPress={() =>
        router.push({
          pathname: '/eventos/[eventoId]/gerenciar',
          params: { eventoId: item.event.id },
        })
      }
    >
      <View style={styles.organizerEventIcon}>
        <MaterialCommunityIcons
          name={compact ? 'calendar-check-outline' : 'chart-box-outline'}
          size={20}
          color="#ef4444"
        />
      </View>
      <View style={styles.organizerEventText}>
        <Text style={styles.organizerEventTitle}>{item.event.titulo}</Text>
        <Text style={styles.organizerEventMeta}>
          {item.event.dataInicio ? new Date(item.event.dataInicio).toLocaleDateString('pt-BR') : 'Sem data'} - {item.participants} participantes
        </Text>
        {!compact ? (
          <Text style={styles.organizerEventMeta}>
            {item.ticketsSold} ingressos - {formatCurrency(item.revenue)} - {item.posts} posts
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
    </Pressable>
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
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    gap: 22,
    paddingBottom: 36,
    paddingTop: 18,
  },
  header: {
    alignItems: 'center',
    gap: 18,
  },
  avatarWrap: {
    borderRadius: 64,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderColor: '#ffffff',
    borderRadius: 64,
    borderWidth: 4,
    height: 128,
    width: 128,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderColor: '#ffffff',
    borderRadius: 64,
    borderWidth: 4,
    height: 128,
    justifyContent: 'center',
    width: 128,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
  },
  identity: {
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  name: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  bio: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 320,
    textAlign: 'center',
  },
  username: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
  socialActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  socialButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  socialButtonAlt: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    position: 'relative',
  },
  socialButtonAltText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 74,
    paddingHorizontal: 8,
  },
  statValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    maxWidth: '100%',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 14,
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
  smallActionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  smallActionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  companyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  companyEditBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  companyField: {
    gap: 7,
  },
  companyLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
  },
  companyInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  companyTextArea: {
    minHeight: 92,
    paddingTop: 10,
  },
  companyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  companyTypeButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  companyTypeButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  companyTypeText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  companyTypeTextActive: {
    color: '#ffffff',
  },
  companySaveButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  companySaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  infoLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 78,
    padding: 12,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  organizerEventRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    padding: 12,
  },
  organizerEventIcon: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  organizerEventText: {
    flex: 1,
    gap: 3,
  },
  organizerEventTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  organizerEventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  linkList: {
    gap: 10,
  },
  linkItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 12,
  },
  linkIcon: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  linkTextGroup: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  linkValue: {
    color: '#64748b',
    fontSize: 13,
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
  actionRow: {
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
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
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
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  editHeader: {
    gap: 6,
    paddingBottom: 18,
    paddingTop: 18,
  },
  editTitle: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  editSubtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 21,
  },
});
