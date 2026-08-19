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
import {
  normalizeUsername,
  normalizeSocialLinks,
  type PartyProfile,
  type ProfileMutationInput,
  type SocialLinkKey,
  type SocialLinks,
  type TipoPerfil,
} from '@/services/profile.service';

type ProfileFormProps = {
  initialProfile?: PartyProfile | null;
  initialName?: string;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: ProfileMutationInput) => Promise<void>;
  onCancel?: () => void;
};

const SOCIAL_FIELDS: {
  key: SocialLinkKey;
  label: string;
  placeholder: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/seuuser',
    icon: 'instagram',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@seuuser',
    icon: 'music-note',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@seucanal',
    icon: 'youtube',
  },
  {
    key: 'x',
    label: 'X',
    placeholder: 'https://x.com/seuuser',
    icon: 'alpha-x-circle-outline',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/seuperfil',
    icon: 'linkedin',
  },
  {
    key: 'site',
    label: 'Site',
    placeholder: 'https://seusite.com',
    icon: 'web',
  },
];

function getInitialLinks(profile?: PartyProfile | null): SocialLinks {
  return SOCIAL_FIELDS.reduce<SocialLinks>((acc, field) => {
    acc[field.key] = profile?.linksSociais[field.key] ?? '';
    return acc;
  }, {});
}

export function ProfileForm({
  initialProfile,
  initialName,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const [tipo, setTipo] = useState<TipoPerfil>(initialProfile?.tipo ?? 'pessoal');
  const [nome, setNome] = useState(initialProfile?.nome || initialName || '');
  const [username, setUsername] = useState(
    initialProfile?.username || normalizeUsername(initialName || initialProfile?.nome || ''),
  );
  const [dataNascimento, setDataNascimento] = useState(initialProfile?.dataNascimento ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [idiomaPreferido, setIdiomaPreferido] = useState(initialProfile?.idiomaPreferido ?? 'pt-BR');
  const [photoUri, setPhotoUri] = useState(initialProfile?.fotoUrl ?? '');
  const [photoFile, setPhotoFile] = useState<CloudinaryUploadFile | null>(null);
  const [links, setLinks] = useState<SocialLinks>(() => getInitialLinks(initialProfile));
  const [submitting, setSubmitting] = useState(false);

  const isBusy = loading || submitting;
  const cleanedLinks = useMemo(() => normalizeSocialLinks(links), [links]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissao necessaria', 'Autorize o acesso as fotos para escolher uma imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `perfil-${Date.now()}.jpg`;
    const mimeType = asset.mimeType ?? 'image/jpeg';

    setPhotoUri(asset.uri);
    setPhotoFile({
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    });
  }

  async function handleSubmit() {
    if (!nome.trim()) {
      Alert.alert('Nome obrigatorio', 'Informe o nome que vai aparecer no seu perfil.');
      return;
    }

    const normalizedUsername = normalizeUsername(username || nome);

    if (normalizedUsername.length < 3) {
      Alert.alert('Username curto', 'Use pelo menos 3 caracteres no @username.');
      return;
    }

    if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      Alert.alert('Data invalida', 'Use o formato AAAA-MM-DD na data de nascimento.');
      return;
    }

    const normalizedLanguage = idiomaPreferido
      .trim()
      .replace(/^([a-z]{2})-([a-z]{2})$/i, (_, language: string, region: string) =>
        `${language.toLowerCase()}-${region.toUpperCase()}`,
      );

    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(normalizedLanguage)) {
      Alert.alert('Idioma invalido', 'Use um codigo como pt-BR, en, es ou fr.');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        tipo,
        username: normalizedUsername,
        nome,
        dataNascimento: dataNascimento || null,
        bio,
        fotoUrl: photoFile ? null : photoUri || null,
        fotoFile: photoFile,
        linksSociais: cleanedLinks,
        idiomaPreferido: normalizedLanguage,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function updateLink(key: SocialLinkKey, value: string) {
    setLinks((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.photoRow}>
        <Pressable style={styles.photoButton} onPress={pickPhoto} disabled={isBusy}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="camera-plus-outline" size={28} color="#0f172a" />
            </View>
          )}
          <View style={styles.photoBadge}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#ffffff" />
          </View>
        </Pressable>

        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>Foto do perfil</Text>
          <Text style={styles.photoText}>A imagem selecionada e enviada para o Cloudinary.</Text>
        </View>
      </View>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentButton, tipo === 'pessoal' && styles.segmentButtonActive]}
          onPress={() => setTipo('pessoal')}
          disabled={isBusy}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={20}
            color={tipo === 'pessoal' ? '#ffffff' : '#334155'}
          />
          <Text style={[styles.segmentText, tipo === 'pessoal' && styles.segmentTextActive]}>
            Pessoal
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentButton, tipo === 'empresa' && styles.segmentButtonActive]}
          onPress={() => setTipo('empresa')}
          disabled={isBusy}
        >
          <MaterialCommunityIcons
            name="office-building-outline"
            size={20}
            color={tipo === 'empresa' ? '#ffffff' : '#334155'}
          />
          <Text style={[styles.segmentText, tipo === 'empresa' && styles.segmentTextActive]}>
            Empresa
          </Text>
        </Pressable>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder={tipo === 'empresa' ? 'Nome da empresa' : 'Seu nome'}
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          editable={!isBusy}
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>@username</Text>
        <View style={styles.inputWithIcon}>
          <MaterialCommunityIcons name="at" size={20} color="#64748b" />
          <TextInput
            value={username}
            onChangeText={(value) => setUsername(normalizeUsername(value))}
            placeholder="seuuser"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            style={styles.iconInput}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Data de nascimento</Text>
        <View style={styles.inputWithIcon}>
          <MaterialCommunityIcons name="calendar-account-outline" size={20} color="#64748b" />
          <TextInput
            value={dataNascimento}
            onChangeText={setDataNascimento}
            placeholder="AAAA-MM-DD"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            editable={!isBusy}
            style={styles.iconInput}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Conte rapidamente o seu tipo de rolê"
          placeholderTextColor="#94a3b8"
          editable={!isBusy}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textArea]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Idioma preferido</Text>
        <View style={styles.inputWithIcon}>
          <MaterialCommunityIcons name="translate" size={20} color="#64748b" />
          <TextInput
            value={idiomaPreferido}
            onChangeText={setIdiomaPreferido}
            placeholder="pt-BR"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            style={styles.iconInput}
          />
        </View>
      </View>

      <View style={styles.linksHeader}>
        <Text style={styles.sectionTitle}>Redes sociais</Text>
      </View>

      {SOCIAL_FIELDS.map((field) => (
        <View style={styles.fieldGroup} key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.inputWithIcon}>
            <MaterialCommunityIcons name={field.icon} size={20} color="#64748b" />
            <TextInput
              value={links[field.key] ?? ''}
              onChangeText={(value) => updateLink(field.key, value)}
              placeholder={field.placeholder}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isBusy}
              style={styles.iconInput}
            />
          </View>
        </View>
      ))}

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

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 36,
  },
  photoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  photoButton: {
    height: 96,
    width: 96,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 48,
    height: 96,
    width: 96,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderRadius: 48,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  photoBadge: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    bottom: 0,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 34,
  },
  photoCopy: {
    flex: 1,
    gap: 4,
  },
  photoTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  photoText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 19,
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
  segmentButtonActive: {
    backgroundColor: '#0f766e',
  },
  segmentText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  textArea: {
    minHeight: 112,
    paddingTop: 12,
  },
  linksHeader: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingTop: 18,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  inputWithIcon: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  iconInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
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
    fontWeight: '800',
  },
});
