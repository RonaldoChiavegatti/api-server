export interface PerfectPayConfig {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
}

export const perfectPayConfig: PerfectPayConfig = {
  apiKey: process.env.PERFECTPAY_API_KEY || '',
  webhookSecret: process.env.PERFECTPAY_WEBHOOK_SECRET || '',
  baseUrl: process.env.PERFECTPAY_BASE_URL || 'https://api.perfectpay.com.br',
};

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'credit_card' | 'pix' | 'boleto';
}

export interface PaymentPlan {
  id: string;
  name: string;
  amount: number;
  interval: 'monthly' | 'yearly';
  description: string;
}

export const paymentMethods: PaymentMethod[] = [
  { id: 'credit_card', name: 'Cartão de Crédito', type: 'credit_card' },
  { id: 'pix', name: 'PIX', type: 'pix' },
  { id: 'boleto', name: 'Boleto', type: 'boleto' },
];

export const paymentPlans: PaymentPlan[] = [
  {
    id: 'basic_monthly',
    name: 'APP QUEIMA DEFINITIVA',
    amount: 27.00,
    interval: 'monthly',
    description: 'Acesso básico mensal',
  },
  {
    id: 'premium_3months',
    name: '💪 Plano Evolução (3 Meses)',
    amount: 39.90,
    interval: 'monthly',
    description: 'Acesso premium trimestral',
  },
  {
    id: 'vip_6months',
    name: '🔥 Plano Transformação (6 Meses)',
    amount: 47.00,
    interval: 'monthly',
    description: 'Acesso VIP semestral',
  }
];

export const PERFECTPAY_CONFIG = {
  checkoutLinks: {
    '30d': 'https://go.perfectpay.com.br/PPU38CPIB8O',
    '90d': 'https://go.perfectpay.com.br/PPU38CPIEMR',
    '180d': 'https://go.perfectpay.com.br/PPU38CPIEN1'
  },
  apiKey: process.env.PERFECTPAY_API_KEY || '',
  webhookSecret: process.env.PERFECTPAY_WEBHOOK_SECRET || ''
};

export type PlanType = '30d' | '90d' | '180d'; 