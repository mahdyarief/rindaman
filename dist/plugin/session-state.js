const sessionStates = new Map();
export const sessionEnabledStates = new Map();
export const sessionSeniorFullstackStates = new Map();
const sessionModeStates = new Map();
export const getSessionState = (sessionID) => {
    const existingState = sessionStates.get(sessionID);
    if (existingState) {
        return existingState;
    }
    const initialState = { changedFiles: [] };
    sessionStates.set(sessionID, initialState);
    return initialState;
};
export const getSessionMode = (sessionID) => sessionModeStates.get(sessionID);
export const setSessionMode = (sessionID, mode) => {
    sessionModeStates.set(sessionID, mode);
};
