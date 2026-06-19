export type LeadStatus =
  | 'novo'
  | 'em_crm'
  | 'descartado'
  | 'ja_cliente'
  | 'expirado'
  | 'duplicata_suspeita'
  | 'dado_invalido'

export type PagespeedClassificacao =
  | 'sem_site'
  | 'site_ruim'
  | 'site_medio'
  | 'site_bom'

export type BatchStatus =
  | 'idle'
  | 'running'
  | 'filtering'
  | 'scoring'
  | 'delivering'
  | 'completed'
  | 'partial'
  | 'failed'

export type LandingStatus =
  | 'nao_gerada'
  | 'gerando'
  | 'publicada'
  | 'erro'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          nome: string | null
          outscraper_api_key: string | null
          vercel_api_token: string | null
          vercel_team_id: string | null
          subdominio_base: string | null
          whatsapp_template: string | null
          leads_hoje: number
          leads_reset_at: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          nome?: string | null
          outscraper_api_key?: string | null
          vercel_api_token?: string | null
          vercel_team_id?: string | null
          subdominio_base?: string | null
          whatsapp_template?: string | null
          leads_hoje?: number
          leads_reset_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          nome?: string | null
          outscraper_api_key?: string | null
          vercel_api_token?: string | null
          vercel_team_id?: string | null
          subdominio_base?: string | null
          whatsapp_template?: string | null
          leads_hoje?: number
          leads_reset_at?: string
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          user_id: string
          batch_id: string | null
          nome: string
          nome_slug: string
          especialidade: string
          telefone: string | null
          telefone_e164: string | null
          cidade: string
          endereco: string | null
          website_url: string | null
          google_maps_place_id: string | null
          pagespeed_score: number | null
          pagespeed_classificacao: PagespeedClassificacao | null
          score_total: number
          foto_url: string | null
          status_kanban: string
          landing_page_url: string | null
          landing_page_vercel_id: string | null
          landing_page_status: LandingStatus
          status: LeadStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          batch_id?: string | null
          nome: string
          nome_slug: string
          especialidade: string
          telefone?: string | null
          telefone_e164?: string | null
          cidade: string
          endereco?: string | null
          website_url?: string | null
          google_maps_place_id?: string | null
          pagespeed_score?: number | null
          pagespeed_classificacao?: PagespeedClassificacao | null
          score_total?: number
          foto_url?: string | null
          status_kanban?: string
          landing_page_url?: string | null
          landing_page_vercel_id?: string | null
          landing_page_status?: LandingStatus
          status?: LeadStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          batch_id?: string | null
          nome?: string
          nome_slug?: string
          especialidade?: string
          telefone?: string | null
          telefone_e164?: string | null
          cidade?: string
          endereco?: string | null
          website_url?: string | null
          google_maps_place_id?: string | null
          pagespeed_score?: number | null
          pagespeed_classificacao?: PagespeedClassificacao | null
          score_total?: number
          foto_url?: string | null
          status_kanban?: string
          landing_page_url?: string | null
          landing_page_vercel_id?: string | null
          landing_page_status?: LandingStatus
          status?: LeadStatus
          created_at?: string
          updated_at?: string
        }
      }
      kanban_stage: {
        Row: {
          id: string
          user_id: string
          nome: string
          cor: string
          ordem: number
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          cor?: string
          ordem: number
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          cor?: string
          ordem?: number
          is_default?: boolean
          created_at?: string
        }
      }
      prospeccao_batch: {
        Row: {
          id: string
          user_id: string
          cidade: string
          especialidade: string
          status: BatchStatus
          total_encontrados: number | null
          total_novos: number | null
          total_duplicados: number | null
          job_id: string | null
          erro_mensagem: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          cidade: string
          especialidade: string
          status?: BatchStatus
          total_encontrados?: number | null
          total_novos?: number | null
          total_duplicados?: number | null
          job_id?: string | null
          erro_mensagem?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          cidade?: string
          especialidade?: string
          status?: BatchStatus
          total_encontrados?: number | null
          total_novos?: number | null
          total_duplicados?: number | null
          job_id?: string | null
          erro_mensagem?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      kanban_activity: {
        Row: {
          id: string
          lead_id: string
          user_id: string
          estagio_anterior: string
          estagio_novo: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id: string
          estagio_anterior: string
          estagio_novo: string
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          user_id?: string
          estagio_anterior?: string
          estagio_novo?: string
          created_at?: string
        }
      }
      lead_note: {
        Row: {
          id: string
          lead_id: string
          user_id: string
          conteudo: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id: string
          conteudo: string
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          user_id?: string
          conteudo?: string
          created_at?: string
        }
      }
      landing_page_template: {
        Row: {
          id: string
          nome: string
          especialidades: string[]
          html_template: string
          css_inline: string | null
          preview_url: string | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          especialidades?: string[]
          html_template: string
          css_inline?: string | null
          preview_url?: string | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          especialidades?: string[]
          html_template?: string
          css_inline?: string | null
          preview_url?: string | null
          ativo?: boolean
          created_at?: string
        }
      }
    }
    Enums: {
      lead_status: LeadStatus
      pagespeed_classificacao: PagespeedClassificacao
      batch_status: BatchStatus
      landing_status: LandingStatus
    }
  }
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type LeadRow = Database['public']['Tables']['leads']['Row']
export type LeadInsert = Database['public']['Tables']['leads']['Insert']
export type LeadUpdate = Database['public']['Tables']['leads']['Update']

export type KanbanStageRow = Database['public']['Tables']['kanban_stage']['Row']
export type KanbanStageInsert = Database['public']['Tables']['kanban_stage']['Insert']
export type KanbanStageUpdate = Database['public']['Tables']['kanban_stage']['Update']

export type ProspeccaoBatchRow = Database['public']['Tables']['prospeccao_batch']['Row']
export type ProspeccaoBatchInsert = Database['public']['Tables']['prospeccao_batch']['Insert']
export type ProspeccaoBatchUpdate = Database['public']['Tables']['prospeccao_batch']['Update']

export type KanbanActivityRow = Database['public']['Tables']['kanban_activity']['Row']
export type KanbanActivityInsert = Database['public']['Tables']['kanban_activity']['Insert']

export type LeadNoteRow = Database['public']['Tables']['lead_note']['Row']
export type LeadNoteInsert = Database['public']['Tables']['lead_note']['Insert']

export type LandingPageTemplateRow = Database['public']['Tables']['landing_page_template']['Row']
export type LandingPageTemplateInsert = Database['public']['Tables']['landing_page_template']['Insert']
export type LandingPageTemplateUpdate = Database['public']['Tables']['landing_page_template']['Update']
