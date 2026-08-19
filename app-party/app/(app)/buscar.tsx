import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatCurrency } from '@/services/event.service';
import {
  searchGlobalEvents,
  type FeedEvent,
  type SearchDateFilter,
} from '@/services/feed.service';
import {
  searchUsers,
  sendFriendRequest,
  type FriendshipSummary,
  type PublicUser,
} from '@/services/social.service';
import { useAuthStore } from '@/stores/auth.store';

type SearchTab = 'pessoas' | 'eventos';

const DATE_FILTERS: { id: SearchDateFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes', label: '30 dias' },
];

function getActionLabel(user: PublicUser): string {
  if (!user.amizade) {
    return 'Adicionar';
  }

  if (user.amizade.status === 'aceita') {
    return 'Amigos';
  }

  if (user.amizade.direction === 'incoming') {
    return 'Responder';
  }

  if (user.amizade.status === 'pendente') {
    return 'Enviada';
  }

  return 'Adicionar';
}

export default function GlobalSearchScreen() {
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<SearchTab>('eventos');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [dateFilter, setDateFilter] = useState<SearchDateFilter>('todos');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const handle = setTimeout(async () => {
      const cleanQuery = query.trim();

      if (activeTab === 'pessoas') {
        if (cleanQuery.length < 2) {
          setUsers([]);
          return;
        }

        setLoading(true);

        try {
          setUsers(await searchUsers(currentUser.id, cleanQuery));
        } catch (error) {
          Alert.alert('Erro na busca', error instanceof Error ? error.message : String(error));
        } finally {
          setLoading(false);
        }

        return;
      }

      if (
        cleanQuery.length < 2 &&
        category.trim().length < 2 &&
        location.trim().length < 2 &&
        dateFilter === 'todos'
      ) {
        setEvents([]);
        return;
      }

      setLoading(true);

      try {
        setEvents(
          await searchGlobalEvents({
            categoria: category,
            data: dateFilter,
            localizacao: location,
            query: cleanQuery,
          }),
        );
      } catch (error) {
        Alert.alert('Erro na busca', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [activeTab, category, currentUser?.id, dateFilter, location, query]);

  async function handleFriendAction(user: PublicUser) {
    if (!currentUser?.id) {
      return;
    }

    if (user.amizade?.direction === 'incoming') {
      router.push('/amizades');
      return;
    }

    if (user.amizade?.status === 'aceita' || user.amizade?.status === 'pendente') {
      return;
    }

    setSendingTo(user.usuarioId);

    try {
      const amizade: FriendshipSummary = await sendFriendRequest(currentUser.id, user.usuarioId);
      setUsers((current) =>
        current.map((item) => (item.usuarioId === user.usuarioId ? { ...item, amizade } : item)),
      );
    } catch (error) {
      Alert.alert('Erro ao adicionar', error instanceof Error ? error.message : String(error));
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Busca global</Text>
          <Text style={styles.subtitle}>Eventos, pessoas, categorias e locais.</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton active={activeTab === 'eventos'} label="Eventos" onPress={() => setActiveTab('eventos')} />
        <TabButton active={activeTab === 'pessoas'} label="Pessoas" onPress={() => setActiveTab('pessoas')} />
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color="#64748b" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={activeTab === 'eventos' ? 'Nome do evento' : 'Nome ou @username'}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {loading ? <ActivityIndicator color="#ef4444" /> : null}
      </View>

      {activeTab === 'eventos' ? (
        <View style={styles.eventFilters}>
          <View style={styles.dualInputs}>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="Categoria"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              style={styles.filterInput}
            />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Localizacao"
              placeholderTextColor="#94a3b8"
              style={styles.filterInput}
            />
          </View>
          <View style={styles.dateRail}>
            {DATE_FILTERS.map((filter) => (
              <Pressable
                key={filter.id}
                style={[styles.dateButton, dateFilter === filter.id && styles.dateButtonActive]}
                onPress={() => setDateFilter(filter.id)}
              >
                <Text style={[styles.dateButtonText, dateFilter === filter.id && styles.dateButtonTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {activeTab === 'pessoas'
          ? users.map((user) => (
              <UserResult
                key={user.usuarioId}
                sending={sendingTo === user.usuarioId}
                user={user}
                onFriendAction={handleFriendAction}
              />
            ))
          : events.map((event) => <EventResult event={event} key={event.id} />)}

        {!loading && activeTab === 'pessoas' && query.trim().length >= 2 && !users.length ? (
          <Text style={styles.emptyText}>Nenhum usuario encontrado.</Text>
        ) : null}

        {!loading && activeTab === 'eventos' && !events.length ? (
          <Text style={styles.emptyText}>Busque por nome, categoria, data ou local para encontrar eventos.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function UserResult({
  onFriendAction,
  sending,
  user,
}: {
  onFriendAction: (user: PublicUser) => Promise<void>;
  sending: boolean;
  user: PublicUser;
}) {
  return (
    <Pressable
      style={styles.userRow}
      onPress={() =>
        router.push({
          pathname: '/usuarios/[usuarioId]',
          params: { usuarioId: user.usuarioId },
        })
      }
    >
      {user.fotoUrl ? (
        <Image source={{ uri: user.fotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{user.nome.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.userText}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.nome}
          </Text>
          <View style={[styles.onlineDot, user.online ? styles.online : styles.offline]} />
        </View>
        <Text style={styles.username} numberOfLines={1}>
          @{user.username || 'semusername'}
        </Text>
      </View>

      <Pressable
        style={[
          styles.actionButton,
          user.amizade?.status === 'aceita' && styles.actionButtonMuted,
          user.amizade?.status === 'pendente' && styles.actionButtonMuted,
        ]}
        onPress={(event) => {
          event.stopPropagation();
          void onFriendAction(user);
        }}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text
            style={[
              styles.actionText,
              user.amizade && user.amizade.status !== 'recusada' && styles.actionTextMuted,
            ]}
          >
            {getActionLabel(user)}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

function EventResult({ event }: { event: FeedEvent }) {
  return (
    <Pressable
      style={styles.eventRow}
      onPress={() =>
        router.push({
          pathname: '/eventos/[eventoId]/index',
          params: { eventoId: event.id },
        })
      }
    >
      {event.capaUrl ? (
        <Image source={{ uri: event.capaUrl }} style={styles.eventImage} />
      ) : (
        <View style={styles.eventFallback}>
          <MaterialCommunityIcons name="party-popper" size={22} color="#ef4444" />
        </View>
      )}
      <View style={styles.eventText}>
        <Text style={styles.eventTitle}>{event.titulo}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {event.categoria} - {event.localNome || 'Local a definir'}
        </Text>
        <Text style={styles.eventMeta}>
          {event.dataInicio ? new Date(event.dataInicio).toLocaleString('pt-BR') : 'Data a definir'}
        </Text>
        <Text style={styles.priceText}>{formatCurrency(event.precoIngresso)}</Text>
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
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
  },
  tabs: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  tabButtonActive: {
    backgroundColor: '#0f766e',
  },
  tabButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '900',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    minHeight: 52,
  },
  eventFilters: {
    gap: 10,
    paddingTop: 12,
  },
  dualInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  filterInput: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  dateRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dateButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  dateButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  dateButtonTextActive: {
    color: '#ffffff',
  },
  list: {
    gap: 12,
    paddingBottom: 32,
    paddingTop: 18,
  },
  userRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 12,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  userText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  username: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  onlineDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  online: {
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#cbd5e1',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 86,
    paddingHorizontal: 12,
  },
  actionButtonMuted: {
    backgroundColor: '#f1f5f9',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionTextMuted: {
    color: '#475569',
  },
  eventRow: {
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
  eventText: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  priceText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    padding: 18,
    textAlign: 'center',
  },
});
