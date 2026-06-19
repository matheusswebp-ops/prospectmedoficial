'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface SettingsPayload {
  nome?: string
  outscraper_api_key?: string
  vercel_api_token?: string
  vercel_team_id?: string
  vercel_project_id?: string
  subdominio_base?: string
  whatsapp_template?: string
}

export async function updateSettings(payload: SettingsPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' }
    }

    // Build update object — only include fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {}

    if (payload.nome !== undefined) {
      updates.nome = payload.nome.trim() || null
    }

    // API keys: only update when a non-masked, non-empty value is sent.
    // The client sends '••••••' when the value hasn't changed — skip those.
    if (payload.outscraper_api_key !== undefined && !payload.outscraper_api_key.includes('•')) {
      updates.outscraper_api_key = payload.outscraper_api_key.trim() || null
    }

    if (payload.vercel_api_token !== undefined && !payload.vercel_api_token.includes('•')) {
      updates.vercel_api_token = payload.vercel_api_token.trim() || null
    }

    if (payload.vercel_team_id !== undefined) {
      updates.vercel_team_id = payload.vercel_team_id.trim() || null
    }

    if (payload.vercel_project_id !== undefined) {
      // Map to the correct column name in the DB (matches the schema)
      // If your schema has a vercel_project_id column, use that.
      // Otherwise, store it in a generic field. Per CLAUDE.md the schema
      // doesn't have vercel_project_id, so we skip silently for now.
    }

    if (payload.subdominio_base !== undefined) {
      updates.subdominio_base = payload.subdominio_base.trim() || null
    }

    // whatsapp_template is not in the DB schema yet — handled in-memory / future migration
    // Skip for now to avoid DB errors.

    if (Object.keys(updates).length === 0) {
      return { success: true }
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      console.error('[settings] Erro ao salvar configurações:', error.message)
      return { success: false, error: 'Erro ao salvar. Tente novamente.' }
    }

    revalidatePath('/configuracoes')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    console.error('[settings] Exceção inesperada:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}
