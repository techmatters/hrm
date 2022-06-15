export type JsonMessage = {
  timestamp: string;
  sender: 'caller' | 'counsellor';
  message: string;
};
