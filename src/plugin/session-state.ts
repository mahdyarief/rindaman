export type SessionQualityState = {
  changedFiles: string[]
  lastCheckAt?: string
  lastCheckStatus?: string
  lastCheckCommand?: string
  lastCheckExitCode?: number | null
}

const sessionStates = new Map<string, SessionQualityState>()
export const sessionEnabledStates = new Map<string, boolean>()
export const sessionSeniorFullstackStates = new Map<string, boolean>()

export const getSessionState = (sessionID: string) => {
  const existingState = sessionStates.get(sessionID)

  if (existingState) {
    return existingState
  }

  const initialState: SessionQualityState = { changedFiles: [] }
  sessionStates.set(sessionID, initialState)
  return initialState
}
