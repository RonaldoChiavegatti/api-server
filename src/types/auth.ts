// Tipos de plano disponíveis
export enum PlanType {
  DAYS_30 = '30 DIAS - APP QUEIMA DEFINITIVA',
  DAYS_90 = '💪 Plano Evolução (3 Meses)',
  DAYS_180 = '🔥 Plano Transformação (6 Meses)'
}

// Simplificar para apenas um nível de acesso
export enum AccessLevel {
  FULL = 'full',  // Acesso completo para todos os planos
  PREMIUM = "PREMIUM"
}

// Interface para o usuário autenticado
export interface AuthenticatedUser {
  uid: string;
  email: string;
  phone: string;
  name: string;
  plan: PlanType;
  accessLevel: AccessLevel;
  planExpiration: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface para o token JWT
export interface JwtPayload {
  uid: string;
  email: string;
  accessLevel: AccessLevel;
  plan: PlanType;
  planExpiration: string;
}

// Interface para o plano do usuário
export interface UserPlan {
  uid: string;
  planType: PlanType;
  startDate: string;
  endDate: string;
  email: string;
  name: string;
  phone: string;
  active: boolean;
}

// Duração dos planos em dias
export const PLAN_DURATION: Record<PlanType, number> = {
  [PlanType.DAYS_30]: 30,
  [PlanType.DAYS_90]: 90,
  [PlanType.DAYS_180]: 180
};

// Lista única de features para todos os planos
export const PLAN_FEATURES = [
  'Dieta Cetogênica Personalizada',
  'Treinos em Casa',
  'Monitoramento de Peso',
  'Lista de Compras Semanal',
  'Protocolo Anti-Estrias',
  'Coquetel Anti-Varizes',
  'Suporte Prioritário',
  'Zero Flacidez',
  'Mentoria Individual',
  'Grupo VIP'
];