import type { ProfileForm, ProfileValues } from '../types'

/** The form with copied details filled in; what was copied replaces what was there, gaps keep what was there. */
export function withCopied(form: ProfileForm, copied: ProfileValues | null): ProfileForm {
  if (!copied) return form
  const filled = Object.fromEntries(
    Object.entries(copied).filter(([, value]) => value),
  ) as Partial<ProfileValues>
  return { ...form, profile: { ...form.profile, ...filled } }
}
