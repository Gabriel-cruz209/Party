export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          email: string;
          criado_em: string | null;
        };
        Insert: {
          id: string;
          email: string;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          criado_em?: string | null;
        };
        Relationships: [];
      };
      perfis: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: Database['public']['Enums']['tipo_perfil'];
          username: string | null;
          nome: string | null;
          data_nascimento: string | null;
          bio: string | null;
          foto_url: string | null;
          links_sociais: Json | null;
          push_notificacoes_ativas: boolean;
          idioma_preferido: string;
          ultima_atividade_em: string | null;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo?: Database['public']['Enums']['tipo_perfil'];
          username?: string | null;
          nome?: string | null;
          data_nascimento?: string | null;
          bio?: string | null;
          foto_url?: string | null;
          links_sociais?: Json | null;
          push_notificacoes_ativas?: boolean;
          idioma_preferido?: string;
          ultima_atividade_em?: string | null;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: Database['public']['Enums']['tipo_perfil'];
          username?: string | null;
          nome?: string | null;
          data_nascimento?: string | null;
          bio?: string | null;
          foto_url?: string | null;
          links_sociais?: Json | null;
          push_notificacoes_ativas?: boolean;
          idioma_preferido?: string;
          ultima_atividade_em?: string | null;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'perfis_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      amizades: {
        Row: {
          id: string;
          solicitante_id: string;
          destinatario_id: string;
          status: Database['public']['Enums']['status_amizade'];
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: {
          id?: string;
          solicitante_id: string;
          destinatario_id: string;
          status?: Database['public']['Enums']['status_amizade'];
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Update: {
          id?: string;
          solicitante_id?: string;
          destinatario_id?: string;
          status?: Database['public']['Enums']['status_amizade'];
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'amizades_solicitante_id_fkey';
            columns: ['solicitante_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amizades_destinatario_id_fkey';
            columns: ['destinatario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      eventos: {
        Row: {
          id: string;
          organizador_id: string;
          titulo: string;
          descricao: string | null;
          tipo: Database['public']['Enums']['tipo_evento'];
          status: Database['public']['Enums']['status_evento'];
          categoria: string;
          local_nome: string | null;
          endereco: string | null;
          latitude: number | null;
          longitude: number | null;
          data_inicio: string | null;
          data_fim: string | null;
          capacidade: number | null;
          classificacao_etaria: number;
          capa_url: string | null;
          preco_ingresso: number;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: {
          id?: string;
          organizador_id: string;
          titulo: string;
          descricao?: string | null;
          tipo?: Database['public']['Enums']['tipo_evento'];
          status?: Database['public']['Enums']['status_evento'];
          categoria?: string;
          local_nome?: string | null;
          endereco?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          capacidade?: number | null;
          classificacao_etaria?: number;
          capa_url?: string | null;
          preco_ingresso?: number;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Update: {
          id?: string;
          organizador_id?: string;
          titulo?: string;
          descricao?: string | null;
          tipo?: Database['public']['Enums']['tipo_evento'];
          status?: Database['public']['Enums']['status_evento'];
          categoria?: string;
          local_nome?: string | null;
          endereco?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          capacidade?: number | null;
          classificacao_etaria?: number;
          capa_url?: string | null;
          preco_ingresso?: number;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'eventos_organizador_id_fkey';
            columns: ['organizador_id'];
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      ingressos: {
        Row: {
          id: string;
          evento_id: string;
          comprador_id: string;
          codigo: string;
          qr_code_url: string | null;
          status: Database['public']['Enums']['status_ingresso'];
          valor_pago: number;
          comprado_em: string | null;
          validado_em: string | null;
          criado_em: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          comprador_id: string;
          codigo: string;
          qr_code_url?: string | null;
          status?: Database['public']['Enums']['status_ingresso'];
          valor_pago?: number;
          comprado_em?: string | null;
          validado_em?: string | null;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          evento_id?: string;
          comprador_id?: string;
          codigo?: string;
          qr_code_url?: string | null;
          status?: Database['public']['Enums']['status_ingresso'];
          valor_pago?: number;
          comprado_em?: string | null;
          validado_em?: string | null;
          criado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ingressos_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ingressos_comprador_id_fkey';
            columns: ['comprador_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      posts_evento: {
        Row: {
          id: string;
          evento_id: string;
          autor_id: string;
          conteudo: string | null;
          midia_url: string | null;
          excluido_em: string | null;
          excluido_por: string | null;
          criado_em: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          autor_id: string;
          conteudo?: string | null;
          midia_url?: string | null;
          excluido_em?: string | null;
          excluido_por?: string | null;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          evento_id?: string;
          autor_id?: string;
          conteudo?: string | null;
          midia_url?: string | null;
          excluido_em?: string | null;
          excluido_por?: string | null;
          criado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_evento_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_evento_autor_id_fkey';
            columns: ['autor_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      mensagens_evento: {
        Row: {
          id: string;
          evento_id: string;
          autor_id: string;
          mensagem: string;
          excluido_em: string | null;
          excluido_por: string | null;
          criado_em: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          autor_id: string;
          mensagem: string;
          excluido_em?: string | null;
          excluido_por?: string | null;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          evento_id?: string;
          autor_id?: string;
          mensagem?: string;
          excluido_em?: string | null;
          excluido_por?: string | null;
          criado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mensagens_evento_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mensagens_evento_autor_id_fkey';
            columns: ['autor_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      participantes_evento: {
        Row: {
          id: string;
          evento_id: string;
          usuario_id: string;
          removido_chat_em: string | null;
          removido_chat_por: string | null;
          criado_em: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          usuario_id: string;
          removido_chat_em?: string | null;
          removido_chat_por?: string | null;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          evento_id?: string;
          usuario_id?: string;
          removido_chat_em?: string | null;
          removido_chat_por?: string | null;
          criado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'participantes_evento_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participantes_evento_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      reacoes_post_evento: {
        Row: {
          id: string;
          evento_id: string;
          post_id: string;
          usuario_id: string;
          tipo: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          evento_id: string;
          post_id: string;
          usuario_id: string;
          tipo: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          evento_id?: string;
          post_id?: string;
          usuario_id?: string;
          tipo?: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reacoes_post_evento_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reacoes_post_evento_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'posts_evento';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reacoes_post_evento_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      localizacoes_usuarios: {
        Row: {
          usuario_id: string;
          latitude: number;
          longitude: number;
          precisao_metros: number | null;
          evento_id: string | null;
          compartilhando: boolean;
          atualizado_em: string;
          criado_em: string;
        };
        Insert: {
          usuario_id: string;
          latitude: number;
          longitude: number;
          precisao_metros?: number | null;
          evento_id?: string | null;
          compartilhando?: boolean;
          atualizado_em?: string;
          criado_em?: string;
        };
        Update: {
          usuario_id?: string;
          latitude?: number;
          longitude?: number;
          precisao_metros?: number | null;
          evento_id?: string | null;
          compartilhando?: boolean;
          atualizado_em?: string;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'localizacoes_usuarios_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'localizacoes_usuarios_evento_id_fkey';
            columns: ['evento_id'];
            referencedRelation: 'eventos';
            referencedColumns: ['id'];
          },
        ];
      };
      notificacoes: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: string;
          titulo: string;
          mensagem: string;
          dados: Json;
          link_href: string | null;
          dedupe_key: string | null;
          lida: boolean;
          lida_em: string | null;
          criado_em: string | null;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo?: string;
          titulo: string;
          mensagem: string;
          dados?: Json;
          link_href?: string | null;
          dedupe_key?: string | null;
          lida?: boolean;
          lida_em?: string | null;
          criado_em?: string | null;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: string;
          titulo?: string;
          mensagem?: string;
          dados?: Json;
          link_href?: string | null;
          dedupe_key?: string | null;
          lida?: boolean;
          lida_em?: string | null;
          criado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notificacoes_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      dispositivos_push: {
        Row: {
          id: string;
          usuario_id: string;
          expo_push_token: string;
          plataforma: string;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          expo_push_token: string;
          plataforma?: string;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          expo_push_token?: string;
          plataforma?: string;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dispositivos_push_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      tickets_suporte: {
        Row: {
          id: string;
          usuario_id: string;
          assunto: string;
          mensagem: string;
          status: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          assunto: string;
          mensagem: string;
          status?: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          assunto?: string;
          mensagem?: string;
          status?: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tickets_suporte_usuario_id_fkey';
            columns: ['usuario_id'];
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      empresas: {
        Row: {
          id: string;
          perfil_id: string;
          nome_fantasia: string | null;
          cnpj: string | null;
          descricao: string | null;
          endereco: string | null;
          telefone: string | null;
          site: string | null;
          tipo_local: string | null;
          verificada: boolean;
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: {
          id?: string;
          perfil_id: string;
          nome_fantasia?: string | null;
          cnpj?: string | null;
          descricao?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          site?: string | null;
          tipo_local?: string | null;
          verificada?: boolean;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Update: {
          id?: string;
          perfil_id?: string;
          nome_fantasia?: string | null;
          cnpj?: string | null;
          descricao?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          site?: string | null;
          tipo_local?: string | null;
          verificada?: boolean;
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'empresas_perfil_id_fkey';
            columns: ['perfil_id'];
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      tipo_evento: 'publico' | 'privado';
      tipo_perfil: 'pessoal' | 'empresa';
      status_evento: 'ativo' | 'cancelado';
      status_ingresso: 'reservado' | 'pago' | 'cancelado' | 'usado';
      status_amizade: 'pendente' | 'aceita' | 'recusada' | 'bloqueada';
    };
    CompositeTypes: Record<string, never>;
  };
};
