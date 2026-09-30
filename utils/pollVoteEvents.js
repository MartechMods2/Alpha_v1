const handlers = new Map();
export const onPollVote = (type, handler) => handlers.set(type, handler);
export const notifyPollVote = async (session, vote) => {
  const handler = handlers.get(session.type);
  if (handler) await handler(session, vote);
};
