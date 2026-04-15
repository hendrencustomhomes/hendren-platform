'use server'

import { createClient } from '@/utils/supabase/server'
import {
  clearScheduleEditPresence,
  getScheduleEditPresence,
  setScheduleEditPresence,
} from '@/lib/schedule/editPresence'

export type ScheduleEditPresenceResult = {
  ok: boolean
  otherUsersEditing?: number
  error?: string
}

export async function enterScheduleEditPresenceAction(
  jobId: string
): Promise<ScheduleEditPresenceResult> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, error: 'Not authenticated' }
    }

    await setScheduleEditPresence(supabase, jobId, user.id)
    const presence = await getScheduleEditPresence(supabase, jobId, user.id)

    return { ok: true, otherUsersEditing: presence.otherUsersEditing }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Presence failed',
    }
  }
}

export async function refreshScheduleEditPresenceAction(
  jobId: string
): Promise<ScheduleEditPresenceResult> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, error: 'Not authenticated' }
    }

    await setScheduleEditPresence(supabase, jobId, user.id)
    const presence = await getScheduleEditPresence(supabase, jobId, user.id)

    return { ok: true, otherUsersEditing: presence.otherUsersEditing }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Presence failed',
    }
  }
}

export async function exitScheduleEditPresenceAction(
  jobId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, error: 'Not authenticated' }
    }

    await clearScheduleEditPresence(supabase, jobId, user.id)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Presence clear failed',
    }
  }
}