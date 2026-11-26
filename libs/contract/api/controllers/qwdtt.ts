export const QWDTT_CONTROLLER = 'qwdtt' as const;

export const QWDTT_ROUTES = {
    GET: '', // get
    UPDATE: '', // patch
    COOKIES: 'cookies', // put
    CLEAR_COOKIES: 'cookies', // delete
    CHECK_COOKIES: 'cookies/check', // post
    GENERATE_HASH: 'hashes/generate', // post
    CHECK_HASHES: 'hashes/check', // get
    USERS: 'users', // get
    UPSERT_USER: 'users', // put
    DELETE_USER: (userId: number | string) => `users/${userId}`, // delete
    RESTART: 'restart', // post
    SUBSCRIPTION: 'subscription', // get (admin preview)
    USER_LINK: (userId: number | string) => `users/${userId}/link`, // get
    NODE_STATUS: 'nodes/status', // get
} as const;
