# PARTY - Manual simples de instalacao e sincronizacao

Este manual usa PowerShell no Windows e assume que o projeto esta em:

```powershell
C:\Users\gabri\OneDrive\Desktop\Senai\Party\app-party
```

## 1. Requisitos

Instale antes:

- Node.js LTS
- Git
- Expo Go no celular ou emulador Android/iOS
- Conta/projeto no Supabase
- Conta Cloudinary com upload preset unsigned
- Chave Google Maps
- Chave Azure Translator
- Chave Groq
- Docker Desktop apenas se for usar Supabase local

Para notificacoes push reais, use uma development build/EAS. No Expo Go, push remoto pode ser limitado, especialmente no Android.

## 2. Entrar na pasta do projeto

```powershell
cd "C:\Users\gabri\OneDrive\Desktop\Senai\Party\app-party"
```

## 3. Instalar dependencias

```powershell
npm install
```

Se aparecerem avisos de vulnerabilidade, primeiro rode o projeto. Nao use `npm audit fix --force` sem revisar, porque pode quebrar versoes do Expo.

## 4. Criar o arquivo `.env`

```powershell
Copy-Item ".env.example" ".env"
notepad ".env"
```

Preencha:

```env
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_EAS_PROJECT_ID=seu-eas-project-id

EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon

EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=seu-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=party_unsigned_upload
EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER=party

EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=sua-chave-google-maps

EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=sua-chave-azure
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=brazilsouth
EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_FROM=pt
EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_TO=en

EXPO_PUBLIC_GROQ_API_KEY=sua-chave-groq
EXPO_PUBLIC_GROQ_BASE_URL=https://api.groq.com
EXPO_PUBLIC_GROQ_MODEL=openai/gpt-oss-20b
```

No Supabase Dashboard, em Authentication > URL Configuration, adicione:

```text
appparty://**
```

## 5. Preparar o Supabase

Importante: as migrations nesta pasta sao incrementais. Elas assumem que o SQL base do projeto ja criou as tabelas principais:

```text
usuarios, perfis, amizades, eventos, ingressos, posts_evento,
mensagens_evento, participantes_evento, notificacoes, empresas
```

Se o seu Supabase estiver vazio, execute primeiro o SQL base criado na etapa anterior do projeto. Depois rode as migrations abaixo.

## 6. Sincronizar Supabase pelo SQL Editor

Opcao mais simples:

1. Abra Supabase Dashboard.
2. Va em SQL Editor.
3. Rode primeiro o SQL base do projeto.
4. Depois rode, nesta ordem:

```text
supabase/migrations/20260816_social_features.sql
supabase/migrations/20260816_event_features.sql
supabase/migrations/20260816_notifications_support.sql
supabase/migrations/20260816_business_feed_audit.sql
```

## 7. Sincronizar Supabase pela CLI

Instale/use a CLI via `npx`.

```powershell
npx supabase login
```

Linke o projeto remoto. O `PROJECT_REF` e o id que aparece na URL do Supabase:

```powershell
npx supabase link --project-ref SEU_PROJECT_REF
```

Verifique o que sera aplicado:

```powershell
npx supabase db push --dry-run
```

Aplique as migrations:

```powershell
npx supabase db push
```

Gere novamente os tipos TypeScript a partir do Supabase remoto:

```powershell
npx supabase gen types typescript --project-id SEU_PROJECT_REF --schema public > ".\src\types\database.types.ts"
```

Depois valide:

```powershell
npx tsc --noEmit
npm run lint
```

## 8. Usar Supabase local, opcional

Precisa do Docker Desktop aberto.

```powershell
npx supabase start
```

Aplicar migrations no banco local:

```powershell
npx supabase db reset
```

Gerar tipos do banco local:

```powershell
npx supabase gen types typescript --local > ".\src\types\database.types.ts"
```

Parar Supabase local:

```powershell
npx supabase stop
```

## 9. Rodar validacoes do app

```powershell
npx tsc --noEmit
npm run lint
```

## 10. Rodar o app Expo

Modo padrao:

```powershell
npx expo start
```

Somente localhost:

```powershell
npx expo start --localhost --port 8081
```

Se a rede local der problema:

```powershell
npx expo start --tunnel
```

No terminal do Expo:

```text
a = abrir Android
i = abrir iOS
w = abrir Web
r = recarregar
```

## 11. Rodar no Android

Com emulador aberto ou celular conectado:

```powershell
npm run android
```

## 12. Rodar no iOS

Somente em macOS:

```powershell
npm run ios
```

## 13. Checklist de configuracao externa

Supabase:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Redirect URL `appparty://**`
- SQL base executado
- Migrations executadas
- Realtime habilitado para tabelas configuradas nas migrations

Cloudinary:

- Cloud name correto
- Upload preset unsigned
- Preset permitindo imagens

Google Maps:

- API key ativa
- Maps SDK Android/iOS habilitado
- Places/Geocoding habilitados, se for usar picker e busca de endereco

Azure:

- Endpoint correto
- Key correta
- Region correta

Groq:

- API key correta
- Modelo preenchido em `EXPO_PUBLIC_GROQ_MODEL`

Expo push:

- `EXPO_PUBLIC_EAS_PROJECT_ID` preenchido
- Teste em development build para push real

## 14. Fluxo rapido para atualizar tudo

Quando baixar alteracoes novas do projeto:

```powershell
cd "C:\Users\gabri\OneDrive\Desktop\Senai\Party\app-party"
git pull
npm install
npx supabase db push --dry-run
npx supabase db push
npx supabase gen types typescript --project-id SEU_PROJECT_REF --schema public > ".\src\types\database.types.ts"
npx tsc --noEmit
npm run lint
npx expo start --localhost --port 8081
```

Se voce usa Supabase local:

```powershell
git pull
npm install
npx supabase db reset
npx supabase gen types typescript --local > ".\src\types\database.types.ts"
npx tsc --noEmit
npm run lint
npx expo start --localhost --port 8081
```

## 15. Problemas comuns

Erro de tabela inexistente no Supabase:

```text
relation "public.perfis" does not exist
```

Solucao: execute primeiro o SQL base do projeto e depois as migrations incrementais.

Erro de variavel ausente:

```text
Missing required environment variable
```

Solucao:

```powershell
notepad ".env"
```

Preencha a variavel faltando e reinicie o Expo.

Erro de Expo CLI com rede:

```text
TypeError: fetch failed
```

Tente:

```powershell
npx expo start --localhost --port 8081
```

ou:

```powershell
npx expo start --tunnel
```

Erro depois de alterar `.env`:

```powershell
Ctrl+C
npx expo start --clear --localhost --port 8081
```

Erro em migrations ja aplicadas:

```powershell
npx supabase migration list
```

Se o remoto foi alterado manualmente fora das migrations, puxe o schema:

```powershell
npx supabase db pull
```

Depois revise o arquivo gerado antes de commitar.

## 16. Ordem recomendada para primeiro setup

```powershell
cd "C:\Users\gabri\OneDrive\Desktop\Senai\Party\app-party"
npm install
Copy-Item ".env.example" ".env"
notepad ".env"
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase gen types typescript --project-id SEU_PROJECT_REF --schema public > ".\src\types\database.types.ts"
npx tsc --noEmit
npm run lint
npx expo start --localhost --port 8081
```

Fontes oficiais usadas para os comandos:

- Expo CLI: https://docs.expo.dev/more/expo-cli/
- Supabase CLI local workflow: https://supabase.com/docs/guides/local-development/cli-workflows
- Supabase CLI reference: https://supabase.com/docs/reference/cli/supabase-migration-new
- Supabase TypeScript types: https://supabase.com/docs/guides/api/rest/generating-types
