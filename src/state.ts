export interface DeletedMessage { authorTag: string; authorId: string; content: string; deletedAt: Date }
export const deletedMessages = new Map<string, DeletedMessage>();
