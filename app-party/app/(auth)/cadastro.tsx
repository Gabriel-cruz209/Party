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

export default function CadastroScreen() {
  const signUpWithEmail = useAuthStore((state) => state.signUpWithEmail);
  const status = useAuthStore((state) => state.status);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = status === 'loading' || submitting;

  async function handleSignUp() {
    if (!nome.trim() || !email.trim() || !password) {
      Alert.alert('Campos obrigatorios', 'Preencha nome, e-mail e senha para criar a conta.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Senha curta', 'Use pelo menos 6 caracteres.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Senhas diferentes', 'Confirme a senha digitada.');
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      const result = await signUpWithEmail({
        nome,
        email,
        password,
      });

      if (result.needsEmailConfirmation) {
        setSuccessMessage('Cadastro criado. Confirme seu e-mail para continuar no Party.');
      }
    } catch (error) {
      Alert.alert('Erro ao cadastrar', error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="account-plus-outline" size={32} color="#ffffff" />
            </View>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Depois do cadastro voce completa seu perfil Party.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                editable={!isBusy}
                style={styles.input}
              />
            </View>

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
                placeholder="Minimo 6 caracteres"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                secureTextEntry
                editable={!isBusy}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                placeholder="Repita sua senha"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                secureTextEntry
                editable={!isBusy}
                style={styles.input}
              />
            </View>

            {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleSignUp} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="arrow-right" size={20} color="#ffffff" />
              )}
              <Text style={styles.primaryButtonText}>Cadastrar</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ja tem conta?</Text>
            <Link href="/login" asChild>
              <Pressable disabled={isBusy}>
                <Text style={styles.footerLink}>Entrar</Text>
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
    gap: 24,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  title: {
    color: '#0f172a',
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 310,
    textAlign: 'center',
  },
  form: {
    gap: 14,
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
  successMessage: {
    backgroundColor: '#ccfbf1',
    borderColor: '#99f6e4',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    padding: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
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
