import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CloudinaryUploadFile } from '@/lib/cloudinary';
import { MapPicker } from '@/components/MapPicker';
import type { EventFormInput, EventLocation, PartyEvent, TipoEvento } from '@/services/event.service';

type EventFormProps = {
  initialEvent?: PartyEvent | null;
  loading?: boolean;
  submitLabel: string;
  onSubmit: (input: EventFormInput) => Promise<void>;
  onCancel?: () => void;
};

const AGE_RATINGS = [0, 10, 12, 14, 16, 18];
const CATEGORIES = [
  { label: 'Festa', value: 'festa' },
  { label: 'Show', value: 'show' },
  { label: 'Festival', value: 'festival' },
  { label: 'Networking', value: 'networking' },
  { label: 'Esporte', value: 'esporte' },
  { label: 'Outro', value: 'outro' },
];

function toDateInput(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function toTimeInput(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(11, 16);
}

function makeIsoDate(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

export function EventForm({
  initialEvent,
  loading = false,
  submitLabel,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const [titulo, setTitulo] = useState(initialEvent?.titulo ?? '');
  const [descricao, setDescricao] = useState(initialEvent?.descricao ?? '');
  const [tipo, setTipo] = useState<TipoEvento>(initialEvent?.tipo ?? 'publico');
  const [categoria, setCategoria] = useState(initialEvent?.categoria ?? 'festa');
  const [data, setData] = useState(toDateInput(initialEvent?.dataInicio));
  const [hora, setHora] = useState(toTimeInput(initialEvent?.dataInicio));
  const [dataFim, setDataFim] = useState(toDateInput(initialEvent?.dataFim));
  const [horaFim, setHoraFim] = useState(toTimeInput(initialEvent?.dataFim));
  const [local, setLocal] = useState<EventLocation>({
    nome: initialEvent?.localNome ?? '',
    endereco: initialEvent?.endereco ?? '',
    latitude: initialEvent?.latitude ?? -23.55052,
    longitude: initialEvent?.longitude ?? -46.633308,
  });
  const [capacidade, setCapacidade] = useState(String(initialEvent?.capacidade ?? 100));
  const [classificacaoEtaria, setClassificacaoEtaria] = useState(
    initialEvent?.classificacaoEtaria ?? 18,
  );
  const [precoIngresso, setPrecoIngresso] = useState(String(initialEvent?.precoIngresso ?? 0));
  const [coverUri, setCoverUri] = useState(initialEvent?.capaUrl ?? '');
  const [coverFile, setCoverFile] = useState<CloudinaryUploadFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isBusy = loading || submitting;
  const capacityNumber = useMemo(() => Number.parseInt(capacidade, 10), [capacidade]);
  const priceNumber = useMemo(
    () => Number.parseFloat(precoIngresso.replace(',', '.')),
    [precoIngresso],
  );

  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissao necessaria', 'Autorize o acesso as fotos para escolher a capa.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.86,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    setCoverUri(asset.uri);
    setCoverFile({
      uri: asset.uri,
      name: asset.fileName ?? `evento-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  }

  async function handleSubmit() {
    if (!data || !hora) {
      Alert.alert('Data obrigatoria', 'Informe data e horario de inicio.');
      return;
    }

    if (!Number.isFinite(capacityNumber) || !Number.isFinite(priceNumber)) {
      Alert.alert('Valores invalidos', 'Confira capacidade e preco do ingresso.');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        titulo,
        descricao,
        tipo,
        categoria,
        dataInicio: makeIsoDate(data, hora),
        dataFim: dataFim ? makeIsoDate(dataFim, horaFim || hora) : null,
        local,
        capacidade: capacityNumber,
        classificacaoEtaria,
        precoIngresso: priceNumber,
        capaUrl: coverFile ? null : coverUri || null,
        capaFile: coverFile,
      });
    } catch (error) {
      Alert.alert('Erro no evento', error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.coverButton} onPress={pickCover} disabled={isBusy}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverFallback}>
            <MaterialCommunityIcons name="image-plus" size={30} color="#0f172a" />
            <Text style={styles.coverText}>Adicionar capa</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentButton, tipo === 'publico' && styles.segmentActive]}
          onPress={() => setTipo('publico')}
          disabled={isBusy}
        >
          <MaterialCommunityIcons
            name="earth"
            size={19}
            color={tipo === 'publico' ? '#ffffff' : '#334155'}
          />
          <Text style={[styles.segmentText, tipo === 'publico' && styles.segmentTextActive]}>
            Publico
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, tipo === 'privado' && styles.segmentActive]}
          onPress={() => setTipo('privado')}
          disabled={isBusy}
        >
          <MaterialCommunityIcons
            name="lock-outline"
            size={19}
            color={tipo === 'privado' ? '#ffffff' : '#334155'}
          />
          <Text style={[styles.segmentText, tipo === 'privado' && styles.segmentTextActive]}>
            Privado
          </Text>
        </Pressable>
      </View>

      <Field label="Titulo" value={titulo} onChangeText={setTitulo} placeholder="Festa Neon" />
      <Field
        label="Descricao"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Regras, atrações, vibe do evento..."
        multiline
      />

      <View style={styles.categoryGroup}>
        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.value}
              style={[styles.categoryChip, categoria === item.value && styles.categoryChipActive]}
              onPress={() => setCategoria(item.value)}
              disabled={isBusy}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  categoria === item.value && styles.categoryChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <Field label="Data" value={data} onChangeText={setData} placeholder="AAAA-MM-DD" />
        <Field label="Hora" value={hora} onChangeText={setHora} placeholder="HH:MM" />
      </View>

      <View style={styles.row}>
        <Field label="Data final" value={dataFim} onChangeText={setDataFim} placeholder="Opcional" />
        <Field label="Hora final" value={horaFim} onChangeText={setHoraFim} placeholder="Opcional" />
      </View>

      <Field
        label="Nome do local"
        value={local.nome}
        onChangeText={(nome) => setLocal((current) => ({ ...current, nome }))}
        placeholder="Club XYZ"
      />
      <MapPicker value={local} onChange={setLocal} />

      <View style={styles.row}>
        <Field
          label="Capacidade"
          value={capacidade}
          onChangeText={setCapacidade}
          placeholder="100"
          keyboardType="number-pad"
        />
        <Field
          label="Preco"
          value={precoIngresso}
          onChangeText={setPrecoIngresso}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.ageGroup}>
        <Text style={styles.label}>Classificacao etaria</Text>
        <View style={styles.ageGrid}>
          {AGE_RATINGS.map((rating) => (
            <Pressable
              key={rating}
              style={[styles.ageChip, classificacaoEtaria === rating && styles.ageChipActive]}
              onPress={() => setClassificacaoEtaria(rating)}
              disabled={isBusy}
            >
              <Text
                style={[
                  styles.ageChipText,
                  classificacaoEtaria === rating && styles.ageChipTextActive,
                ]}
              >
                {rating === 0 ? 'Livre' : `${rating}+`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={isBusy}>
            <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={isBusy}>
          {isBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
          )}
          <Text style={styles.primaryButtonText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  multiline,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline && styles.textArea]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 34,
  },
  coverButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    height: 190,
    overflow: 'hidden',
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  coverText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  segment: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  segmentActive: {
    backgroundColor: '#0f766e',
  },
  segmentText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 116,
    paddingTop: 12,
  },
  ageGroup: {
    gap: 8,
  },
  categoryGroup: {
    gap: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  categoryChipText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  ageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ageChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    minWidth: 70,
    justifyContent: 'center',
  },
  ageChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  ageChipText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '900',
  },
  ageChipTextActive: {
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
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
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
});
