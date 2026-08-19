# PARTY - Guia rapido pos-clone

Objetivo: clonar o repositorio em outra maquina, configurar o minimo necessario e rodar o app.

## 1. Clonar e instalar

```powershell
git clone URL_DO_REPOSITORIO
cd app-party
npm install
```

## 2. Configurar `.env`

```powershell
Copy-Item ".env.example" ".env"
notepad ".env"
```

Preencha pelo menos:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=seu-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=party_unsigned_upload
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=sua-chave-google
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=sua-chave-azure
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=brazilsouth
EXPO_PUBLIC_GROQ_API_KEY=sua-chave-groq
EXPO_PUBLIC_GROQ_MODEL=openai/gpt-oss-20b
```

## 3. Banco Supabase

Se o Supabase remoto ja esta pronto, pule esta etapa.

Se precisar sincronizar migrations:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Se o banco estiver zerado, rode primeiro o SQL base das tabelas no Supabase SQL Editor. Depois aplique as migrations da pasta:

```text
supabase/migrations/20260816_social_features.sql
supabase/migrations/20260816_event_features.sql
supabase/migrations/20260816_notifications_support.sql
supabase/migrations/20260816_business_feed_audit.sql
```

## 4. Validar

```powershell
npx tsc --noEmit
npm run lint
```

## 5. Rodar o app

```powershell
npx expo start --localhost --port 8081
```

Se for testar no celular e localhost nao conectar:

```powershell
npx expo start --tunnel
```

## 6. Comando completo rapido

```powershell
git clone URL_DO_REPOSITORIO
cd app-party
npm install
Copy-Item ".env.example" ".env"
notepad ".env"
npx tsc --noEmit
npm run lint
npx expo start --localhost --port 8081
```

## 7. Problemas comuns

Erro de variavel faltando:

```powershell
notepad ".env"
```

Erro de tabela inexistente:

```text
Execute o SQL base + migrations no Supabase.
```

Expo com erro de rede:

```powershell
npx expo start --tunnel
```

Depois de alterar `.env`, reinicie:

```powershell
npx expo start --clear --localhost --port 8081
```
