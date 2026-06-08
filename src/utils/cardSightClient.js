import { CardSightAI } from 'cardsightai';

let _client = null;

export function getCardSightClient() {
  if (!_client) {
    const apiKey = process.env.CARDSIGHTAI_API_KEY;
    if (!apiKey) throw new Error('CARDSIGHTAI_API_KEY is not set');
    _client = new CardSightAI({ apiKey });
  }
  return _client;
}
