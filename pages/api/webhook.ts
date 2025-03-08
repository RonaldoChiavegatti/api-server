import type { NextApiRequest, NextApiResponse } from 'next';
import { processPerfectPayWebhook } from '../../src/services/perfectpay';
import { PERFECTPAY_CONFIG } from '../../src/config/perfectpay';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verifica se é uma requisição POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // Verifica o secret do webhook
  const webhookSecret = req.headers['x-perfectpay-webhook-secret'];
  if (webhookSecret !== PERFECTPAY_CONFIG.webhookSecret) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  try {
    const webhookData = req.body;
    const result = await processPerfectPayWebhook(webhookData);

    if (result.success) {
      return res.status(200).json({ message: result.message });
    } else {
      return res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}