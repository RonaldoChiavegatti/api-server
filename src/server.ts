import 'dotenv/config';
import { 
  PerfectPayWebhookSchema, 
  getPlanDetails
} from './schemas/webhookSchema';
import { getAuth } from 'firebase-admin/auth';
import express from 'express';
import cors from 'cors';
import { processPerfectPayWebhook } from './services/perfectpay';
import {
  rateLimiter,
  webhookRateLimiter,
  securityHeaders,
  verifyWebhookSignature,
  requestLogger
} from './middleware/security';
import { PlanType } from './types/auth';

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());
app.use(securityHeaders);
app.use(requestLogger);

// Rate limiting global
app.use(rateLimiter);

// Rota raiz para verificação do servidor
app.get('/', (_req, res) => {
  res.json({ 
    status: 'online',
    message: 'API Server está funcionando',
    timestamp: new Date().toISOString()
  });
});

// Atualizar a rota do webhook
app.post('/webhook/perfectpay',
  webhookRateLimiter,
  verifyWebhookSignature,
  async (req: express.Request, res: express.Response) => {
    try {
      const validatedData = PerfectPayWebhookSchema.parse(req.body);
      const signatureHeader = req.headers['x-perfectpay-signature'] as string;
      
      console.log('🔄 Webhook recebido:', {
        headers: req.headers,
        signature: signatureHeader,
        data: validatedData
      });
      
      const result = await processPerfectPayWebhook(validatedData, signatureHeader);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('❌ Erro no webhook:', error);
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
);

// Atualizar rota de teste de pagamento
app.post('/test/payment',
  rateLimiter,
  async (req, res) => {
    try {
      const testData = {
        event: 'payment.approved',
        transaction_id: `TEST-${Date.now()}`,
        status: 'approved',
        amount: 27.00,
        payment_method: 'credit_card',
        customer: {
          name: req.body.customer?.name || 'Usuário Teste',
          email: req.body.customer?.email || `teste${Date.now()}@example.com`,
          phone: req.body.customer?.phone || `+5511${Date.now().toString().slice(-8)}`
        },
        created_at: new Date().toISOString(),
        product: {
          name: PlanType.DAYS_30, // Use enum value
          price: 27.00
        }
      };

      const validatedData = PerfectPayWebhookSchema.parse(testData);
      const result = await processPerfectPayWebhook(validatedData);
      
      res.json({
        success: true,
        message: 'Teste processado com sucesso',
        data: validatedData,
        result
      });
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
);

// Rota de teste para simular webhook da PerfectPay
app.post('/test/webhook',
  rateLimiter,
  async (req, res) => {
    try {
      // Usar os dados do body se fornecidos, caso contrário usar dados padrão
      const { customer = {}, product = {} } = req.body;

      const mockWebhookData = {
        event: 'payment.approved',
        transaction_id: 'TEST-' + Date.now(),
        status: 'approved',
        amount: product.price || 27.00,
        payment_method: 'credit_card',
        customer: {
          name: customer.name || 'Usuário Teste',
          email: customer.email || 'guimartines99@gmail.com',
          phone: customer.phone || '+5511999999999'
        },
        created_at: new Date().toISOString(),
        product: {
          name: product.name || PlanType.DAYS_30,
          price: product.price || 27.00
        }
      };

      console.log('🔄 Iniciando teste de webhook...');
      console.log('📦 Dados do webhook:', JSON.stringify(mockWebhookData, null, 2));

      const result = await processPerfectPayWebhook(mockWebhookData);
      
      console.log('✅ Resultado do processamento:', result);

      res.status(200).json({
        success: true,
        message: 'Teste de webhook concluído',
        data: mockWebhookData,
        result
      });
    } catch (error) {
      console.error('❌ Erro no teste de webhook:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro no teste de webhook',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
);

// Rota de teste simples
app.post('/test', (req, res) => {
  console.log('Teste recebido:', req.body);
  res.json({
    success: true,
    message: 'Teste recebido com sucesso',
    timestamp: new Date().toISOString()
  });
});

app.post('/test/verify-subscription', 
  rateLimiter,
  async (req, res) => {
    try {
      // Use PlanType enum
      const requestedPlan = req.body.plan || 'DAYS_30';
      const planType = PlanType[requestedPlan as keyof typeof PlanType];
      
      if (!planType) {
        throw new Error('Plano inválido');
      }

      const planDetails = getPlanDetails(planType);

      if (!planDetails) {
        throw new Error('Plano inválido');
      }

      const testData = {
        event: 'payment.approved',
        transaction_id: `TEST-${Date.now()}`,
        status: 'approved',
        amount: planDetails.price,
        payment_method: 'credit_card',
        customer: {
          name: req.body.name || 'Usuário Teste',
          email: req.body.email || `teste${Date.now()}@example.com`,
          phone: req.body.phone || `+5511${Date.now().toString().slice(-8)}`
        },
        created_at: new Date().toISOString(),
        product: {
          name: planDetails.name,
          price: planDetails.price
        },
        checkout_url: `https://checkout.perfectpay.com.br/pay/${planDetails.checkoutId}`,
        subscription: req.body.subscription ? {
          id: `sub_${Date.now()}`,
          status: 'active' as const, // Fix subscription status type
          start_date: new Date().toISOString(),
          plan_type: planType, // Use the correct plan type
          price: planDetails.price
        } : undefined
      };

      console.log('🔄 Dados de teste:', JSON.stringify(testData, null, 2));

      const validatedData = PerfectPayWebhookSchema.parse(testData);
      const webhookResult = await processPerfectPayWebhook(validatedData);

      // Verificar usuário no Firebase
      const auth = getAuth();
      let firebaseUser = null;
      let userClaims = null;

      try {
        // Buscar usuário completo com customClaims
        const userRecord = await auth.getUser(
          (await auth.getUserByEmail(validatedData.customer.email)).uid
        );
        firebaseUser = userRecord;
        userClaims = userRecord.customClaims;
        
        console.log('✅ Usuário encontrado:', userRecord.uid);
        console.log('📝 Claims:', userClaims);
      } catch (error) {
        console.log('⚠️ Usuário não encontrado ou erro:', error);
      }

      res.status(200).json({
        success: true,
        webhookResult,
        firebaseAccount: firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          claims: userClaims
        } : null,
        testData: validatedData
      });
    } catch (error) {
      console.error('❌ Erro na verificação:', error);
      res.status(400).json({
        success: false,
        message: 'Falha na verificação',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor iniciado!');
  console.log(`📡 Porta local: http://localhost:${PORT}`);
  console.log('💡 Use o ngrok para expor esta porta');
});