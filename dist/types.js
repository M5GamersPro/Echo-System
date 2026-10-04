export const TICKET_TYPES = ['1', '2', '3', '4', '5'];
export const isTicketType = (value) => TICKET_TYPES.some(ticketType => ticketType === value);
