import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '@/stores/auth.store';

export default function LoginScreen() {
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const status = useAuthStore((state) => state.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState<'email' | 'google' | null>(null);

  const isBusy = status === 'loading' || !!submitting;

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Campos obrigatorios', 'Informe e-mail e senha para entrar.');
      return;
    }

    setSubmitting('email');

    try {
      await signInWithEmail(email, password);
    } catch (error) {
      Alert.alert('Erro ao entrar', error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting('google');

    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Erro com Google', error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name="party-popper" size={34} color="#ffffff" />
            </View>
            <Text style={styles.title}>Party</Text>
            <Text style={styles.subtitle}>Entre para descobrir eventos, amigos e memórias.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                editable={!isBusy}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Sua senha"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                secureTextEntry
                editable={!isBusy}
                style={styles.input}
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={handleEmailLogin} disabled={isBusy}>
              {submitting === 'email' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="login" size={20} color="#ffffff" />
              )}
              <Text style={styles.primaryButtonText}>Entrar</Text>
            </Pressable>

            <Pressable style={styles.googleButton} onPress={handleGoogleLogin} disabled={isBusy}>
              {submitting === 'google' ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <MaterialCommunityIcons name="google" size={20} color="#ef4444" />
              )}
              <Text style={styles.googleButtonText}>Continuar com Google</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda nao tem conta?</Text>
            <Link href="/cadastro" asChild>
              <Pressable disabled={isBusy}>
                <Text style={styles.footerLink}>Criar cadastro</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    padding: 24,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  title: {
    color: '#0f172a',
    fontSize: 42,
    fontWeight: '900',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
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
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 15,
  },
  footerLink: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
});
