import { PlanType } from '../types/auth';  // Fix relative import path
import { z } from 'zod';

export const VALID_PLANS = {
  DAYS_30: '30 DIAS - APP QUEIMA DEFINITIVA',
  DAYS_90: '💪 Plano Evolução (3 Meses)',
  DAYS_180: '🔥 Plano Transformação (6 Meses)',
} as const;

export type LocalPlanType = typeof VALID_PLANS[keyof typeof VALID_PLANS];

export interface PlanDetails {
  name: LocalPlanType;
  durationDays: number;
  checkoutId: string;
  price: number;
  features: string[];
}

export const PLAN_DETAILS: Record<LocalPlanType, PlanDetails> = {
  [VALID_PLANS.DAYS_30]: {
    name: VALID_PLANS.DAYS_30,
    durationDays: 30,
    checkoutId: 'PPU38CPIB8O',  // ID correto do plano de 30 dias
    price: 27.00,
    features: ['Acesso básico por 30 dias', 'Suporte básico']
  },
  [VALID_PLANS.DAYS_90]: {
    name: VALID_PLANS.DAYS_90,
    durationDays: 90,
    checkoutId: 'PPU38CPIR95',  // ID atualizado do plano de 90 dias
    price: 39.90,
    features: ['Acesso completo por 3 meses', 'Suporte prioritário']
  },
  [VALID_PLANS.DAYS_180]: {
    name: VALID_PLANS.DAYS_180,
    durationDays: 180,
    checkoutId: 'PPU38CPIEN1',  // ID correto do plano de 180 dias
    price: 47.00,
    features: ['Acesso completo por 6 meses', 'Suporte VIP']
  }
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PENDING: 'pending',
  FAILED: 'failed'
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  last_payment_date?: string;
  next_payment_date?: string;
  plan_type: LocalPlanType;
  price: number;
  billing_cycle?: string;
  payment_method?: string;
}

export const SubscriptionSchema = z.object({
  id: z.string().nonempty('Subscription ID is required'),
  status: z.enum(Object.values(SUBSCRIPTION_STATUS) as [string, ...string[]], {
    errorMap: () => ({ message: 'Status de assinatura inválido' })
  }),
  start_date: z.string().datetime('Invalid start date'),
  end_date: z.string().datetime('Invalid end date').optional(),
  last_payment_date: z.string().datetime('Invalid payment date').optional(),
  next_payment_date: z.string().datetime('Invalid next payment date').optional(),
  plan_type: z.enum(Object.values(VALID_PLANS) as [LocalPlanType, ...LocalPlanType[]], {
    errorMap: () => ({ message: 'Tipo de plano inválido' })
  }),
  price: z.number().positive('Price must be positive'),
  billing_cycle: z.string().optional(),
  payment_method: z.string().optional()
});

export const PerfectPayWebhookSchema = z.object({
  event: z.string().nonempty('Event is required'),
  transaction_id: z.string().nonempty('Transaction ID is required'),
  status: z.string().nonempty('Status is required'),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.string().nonempty('Payment method is required'),
  created_at: z.string().datetime('Invalid datetime format'),
  customer: z.object({
    name: z.string().nonempty('Customer name is required'),
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(/^\+\d{12,13}$/, 'Invalid phone format')
  }),
  checkout_url: z.string().optional(),
  subscription: SubscriptionSchema.optional(),
  product: z.object({
    name: z.enum([VALID_PLANS.DAYS_30, VALID_PLANS.DAYS_90, VALID_PLANS.DAYS_180]),
    price: z.number().positive('Price must be positive')
  })
});

export const identifyPlan = (productName: string): LocalPlanType | null => {
  // Normaliza o nome do produto removendo emojis e espaços extras
  const normalizedName = productName
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .trim();

  if (normalizedName.includes('30 DIAS')) return PlanType.DAYS_30;
  if (normalizedName.includes('3 Meses')) return PlanType.DAYS_90;
  if (normalizedName.includes('6 Meses')) return PlanType.DAYS_180;
  
  // Try exact match
  const plan = Object.values(VALID_PLANS).find(p => p === productName);
  if (plan) return plan;

  console.error('❌ Plano não identificado:', productName);
  return null;
};

export const getPlanDetails = (planType: LocalPlanType): PlanDetails => {
  return PLAN_DETAILS[planType];
};

// Função auxiliar para obter detalhes do plano por checkoutId
export const getPlanByCheckoutId = (checkoutId: string): PlanDetails | null => {
  const plan = Object.values(PLAN_DETAILS).find(p => p.checkoutId === checkoutId);
  return plan || null;
};

export const getPlanFromWebhookData = (data: PerfectPayWebhookData): PlanDetails | null => {
  // Primeiro tenta pelo checkout_url se disponível
  if (data.checkout_url) {
    const checkoutId = data.checkout_url.split('/').pop();
    if (checkoutId) {
      const planByCheckoutId = getPlanByCheckoutId(checkoutId);
      if (planByCheckoutId) {
        console.log('✅ Plano identificado pelo checkoutId:', planByCheckoutId.name);
        return planByCheckoutId;
      }
    }
  }

  // Tenta pelo subscription se disponível
  if (data.subscription?.plan_type) {
    const planDetails = PLAN_DETAILS[data.subscription.plan_type as LocalPlanType];
    if (planDetails) {
      console.log('✅ Plano identificado pela assinatura:', planDetails.name);
      return planDetails;
    }
  }

  // Se não encontrou pelo checkout_url, tenta pelo nome do produto
  const planType = identifyPlan(data.product.name);
  if (planType) {
    console.log('✅ Plano identificado pelo nome:', planType);
    return PLAN_DETAILS[planType];
  }

  console.error('❌ Não foi possível identificar o plano');
  return null;
};

export const validateSubscription = (data: unknown): SubscriptionData | null => {
  try {
    const validated = SubscriptionSchema.parse(data);
    console.log('✅ Dados da assinatura validados com sucesso');
    return validated as SubscriptionData;
  } catch (error) {
    console.error('❌ Erro na validação da assinatura:', error);
    return null;
  }
};

export type PerfectPayWebhookData = z.infer<typeof PerfectPayWebhookSchema>;
export { PlanType };

export const planDurations = {
  [PlanType.DAYS_30]: 30,
  [PlanType.DAYS_90]: 90,
  [PlanType.DAYS_180]: 180
};

export const planPrices = {
  [PlanType.DAYS_30]: 27.00,
  [PlanType.DAYS_90]: 47.00,
  [PlanType.DAYS_180]: 67.00
};

