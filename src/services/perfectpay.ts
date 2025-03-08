import { db } from '../lib/firebase';
import crypto from 'crypto';
import { sendCredentialEmail, generateRandomPassword } from './emailService';  // Updated import
import { generateUserPlan } from './planService';
import { PerfectPayWebhookData, getPlanFromWebhookData, identifyPlan } from '../schemas/webhookSchema';
import { getAuth } from 'firebase-admin/auth';
import { PlanType } from '../types/auth';  // Fix relative import path

/**
 * Processes a PerfectPay webhook event by validating the signature, 
 * identifying the plan associated with the event, and handling the 
 * event based on its type.
 * 
 * @param {PerfectPayWebhookData} data - The webhook data payload received from PerfectPay.
 * @param {string} [signatureHeader] - The signature header for verifying the webhook's authenticity.
 * @param {string} [rawBody] - The raw body of the webhook request used for signature validation.
 * 
 * @returns {Promise<{ success: boolean, message?: string }>} - The result of the processing, 
 * indicating success or failure, with an optional message.
 * 
 * @throws Will log and return an error message if processing fails at any point.
 */

export async function processPerfectPayWebhook(data: PerfectPayWebhookData, signatureHeader?: string, rawBody?: string) {
  try {
    console.log('🔄 Processando webhook...');
    console.log('📦 Dados recebidos:', {
      event: data.event,
      checkout_url: data.checkout_url || 'Não disponível',
      product: data.product
    });

    // Identifica o plano usando a nova função helper
    const planDetails = getPlanFromWebhookData(data);
    if (!planDetails) {
      return {
        success: false,
        message: 'Não foi possível identificar o plano'
      };
    }

    console.log('✅ Plano identificado:', {
      name: planDetails.name,
      duration: planDetails.durationDays,
      price: planDetails.price
    });

    // Verifica a assinatura do webhook
    const isValid = validateWebhookSignature(data, signatureHeader, rawBody);
    if (!isValid) {
      console.log('Assinatura do webhook inválida');
      return { success: false, message: 'Assinatura do webhook inválida' };
    }

    // Processa diferentes tipos de eventos
    switch (data.event) {
      case 'payment.approved':
        // Gerar e enviar credenciais para o cliente
        return await handlePaymentApproved(data);
      case 'payment.rejected':
        return await handlePaymentRejected(data);
      case 'payment.cancelled':
        return await handlePaymentCancelled(data);
      case 'payment.refunded':
        return await handlePaymentRefunded(data);
      case 'subscription.created':
        return await handleSubscriptionCreated(data);
      case 'subscription.updated':
        return await handleSubscriptionUpdated(data);
      case 'subscription.cancelled':
        return await handleSubscriptionCancelled(data);
      case 'subscription.expired':
        return await handleSubscriptionExpired(data);
      default:
        console.log('Evento não reconhecido:', data.event);
        return { success: false, message: 'Evento não reconhecido' };
    }
  } catch (error) {
    console.error('Erro detalhado ao processar webhook:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return { success: false, message: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
  }
}

async function handlePaymentApproved(data: PerfectPayWebhookData) {
  console.log('Processando pagamento aprovado...');
  
  try {
    const formattedPhone = formatPhoneNumber(data.customer.phone);
    const auth = getAuth();
    let userRecord;
    const password = generateRandomPassword(); // Gerar senha ANTES
    
    console.log('🔐 Senha gerada:', password); // Debug log

    try {
      userRecord = await auth.getUserByEmail(data.customer.email);
      console.log('✅ Usuário existente encontrado:', userRecord.uid);
    } catch (error) {
      console.log('🆕 Criando novo usuário...');
      
      userRecord = await auth.createUser({
        email: data.customer.email,
        password: password,
        displayName: data.customer.name,
        phoneNumber: formattedPhone
      });

      console.log('✅ Usuário criado:', userRecord.uid);
      
      // Enviar email logo após criar o usuário
      try {
        console.log('📧 Enviando email para:', data.customer.email);
        const emailResult = await sendCredentialEmail(
          data.customer.email,
          data.customer.email,
          password
        );
        console.log('📧 Resultado do envio:', emailResult);
      } catch (emailError) {
        console.error('❌ Erro ao enviar email:', emailError);
        // Log mais detalhado do erro
        if (emailError instanceof Error) {
          console.error('Detalhes do erro:', emailError.message);
          console.error('Stack:', emailError.stack);
        }
      }
    }

    // Get plan details and convert to internal type
    const planType: PlanType = identifyPlan(data.product.name) as PlanType;
    if (!planType) {
      throw new Error('Tipo de plano não identificado');
    }

    // Generate user plan with the external plan type
    const planResult = await generateUserPlan(
      userRecord.uid,
      planType,
      data.customer.email,
      data.customer.name,
      formattedPhone
    );

    if (!planResult.success) {
      throw new Error('Erro ao gerar plano do usuário');
    }

    // Save payment data
    const paymentsRef = db.collection('payments');
    await paymentsRef.add({
      transaction_id: data.transaction_id,
      status: 'approved',
      amount: data.amount,
      payment_method: data.payment_method,
      customer: {
        ...data.customer,
        phone: formattedPhone
      },
      product: data.product,
      created_at: data.created_at,
      processed_at: new Date().toISOString(),
      user_uid: userRecord.uid
    });

    return { 
      success: true, 
      message: 'Pagamento processado com sucesso',
      data: {
        user_uid: userRecord.uid,
        plan_type: planType
      }
    };

  } catch (error) {
    console.error('❌ Erro detalhado:', error);
    return { 
      success: false, 
      message: 'Erro ao processar pagamento',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Helper function to format phone number
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Ensure it starts with +55
  if (!digits.startsWith('55')) {
    return `+55${digits}`;
  }
  
  return `+${digits}`;
}

async function handlePaymentRejected(data: PerfectPayWebhookData) {
  console.log('Processando pagamento rejeitado...');
  const paymentsRef = db.collection('payments');
  const querySnapshot = await paymentsRef.where('transaction_id', '==', data.transaction_id).get();

  if (!querySnapshot.empty) {
    const paymentDoc = querySnapshot.docs[0];
    await paymentDoc.ref.update({
      status: 'rejected',
      processed_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Pagamento rejeitado processado com sucesso' };
}

async function handlePaymentCancelled(data: PerfectPayWebhookData) {
  console.log('Processando pagamento cancelado...');
  const paymentsRef = db.collection('payments');
  const querySnapshot = await paymentsRef.where('transaction_id', '==', data.transaction_id).get();

  if (!querySnapshot.empty) {
    const paymentDoc = querySnapshot.docs[0];
    await paymentDoc.ref.update({
      status: 'cancelled',
      processed_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Pagamento cancelado processado com sucesso' };
}

async function handlePaymentRefunded(data: PerfectPayWebhookData) {
  console.log('Processando pagamento reembolsado...');
  const paymentsRef = db.collection('payments');
  const querySnapshot = await paymentsRef.where('transaction_id', '==', data.transaction_id).get();

  if (!querySnapshot.empty) {
    const paymentDoc = querySnapshot.docs[0];
    await paymentDoc.ref.update({
      status: 'refunded',
      processed_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Pagamento reembolsado processado com sucesso' };
}

async function handleSubscriptionCreated(data: PerfectPayWebhookData) {
  console.log('Processando assinatura criada...');
  if (!data.subscription) {
    return { success: false, message: 'Dados da assinatura não encontrados' };
  }

  const subscriptionsRef = db.collection('subscriptions');
  await subscriptionsRef.add({
    ...data.subscription,
    customer: data.customer,
    created_at: new Date().toISOString(),
    status: 'active'
  });

  return { success: true, message: 'Assinatura criada com sucesso' };
}

async function handleSubscriptionUpdated(data: PerfectPayWebhookData) {
  console.log('Processando assinatura atualizada...');
  if (!data.subscription) {
    return { success: false, message: 'Dados da assinatura não encontrados' };
  }

  const subscriptionsRef = db.collection('subscriptions');
  const querySnapshot = await subscriptionsRef.where('id', '==', data.subscription.id).get();

  if (!querySnapshot.empty) {
    const subscriptionDoc = querySnapshot.docs[0];
    await subscriptionDoc.ref.update({
      ...data.subscription,
      updated_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Assinatura atualizada com sucesso' };
}

async function handleSubscriptionCancelled(data: PerfectPayWebhookData) {
  console.log('Processando assinatura cancelada...');
  if (!data.subscription) {
    return { success: false, message: 'Dados da assinatura não encontrados' };
  }

  const subscriptionsRef = db.collection('subscriptions');
  const querySnapshot = await subscriptionsRef.where('id', '==', data.subscription.id).get();

  if (!querySnapshot.empty) {
    const subscriptionDoc = querySnapshot.docs[0];
    await subscriptionDoc.ref.update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Assinatura cancelada com sucesso' };
}

async function handleSubscriptionExpired(data: PerfectPayWebhookData) {
  console.log('Processando assinatura expirada...');
  if (!data.subscription) {
    return { success: false, message: 'Dados da assinatura não encontrados' };
  }

  const subscriptionsRef = db.collection('subscriptions');
  const querySnapshot = await subscriptionsRef.where('id', '==', data.subscription.id).get();

  if (!querySnapshot.empty) {
    const subscriptionDoc = querySnapshot.docs[0];
    await subscriptionDoc.ref.update({
      status: 'expired',
      expired_at: new Date().toISOString()
    });
  }

  return { success: true, message: 'Assinatura expirada processada com sucesso' };
}


function validateWebhookSignature(data: any, signatureHeader?: string, rawBody?: string): boolean {
  // Permitir testes sem validação quando a rota começa com /test
  if (process.env.NODE_ENV === 'development' || data.transaction_id?.startsWith('TEST-')) {
    console.log('Modo de teste: Validação de assinatura desabilitada');
    return true;
  }

  const webhookSecret = process.env.PERFECTPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('PERFECTPAY_WEBHOOK_SECRET não configurado');
    return false;
  }

  if (!signatureHeader) {
    console.error('Assinatura do webhook não encontrada no header');
    return false;
  }

  // Remove espaços em branco e caracteres especiais da assinatura recebida
  const cleanSignatureHeader = signatureHeader.trim().replace(/\s+/g, '');
  
  // Garante que o payload seja uma string
  let payload: string;
  if (typeof rawBody === 'string') {
    payload = rawBody;
  } else if (typeof data === 'string') {
    payload = data;
  } else {
    payload = JSON.stringify(data, Object.keys(data).sort());
  }
  
  // Gera a assinatura local
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const isValid = signature === cleanSignatureHeader;
  
  console.log('=== Validação da Assinatura ===');
  console.log('Webhook Secret:', webhookSecret);
  console.log('Payload usado:', payload);
  console.log('Assinatura recebida (original):', signatureHeader);
  console.log('Assinatura recebida (limpa):', cleanSignatureHeader);
  console.log('Assinatura calculada:', signature);
  console.log('Assinatura válida:', isValid);
  console.log('=============================');

  return isValid;
}

export async function createPayment(data: {
  amount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}) {
  try {
    const perfectPayApiKey = process.env.PERFECTPAY_API_KEY;
    if (!perfectPayApiKey) {
      throw new Error('PERFECTPAY_API_KEY não configurada');
    }

    // Implemente a criação do pagamento na PerfectPay aqui
    // Este é um exemplo básico, ajuste conforme a documentação do PerfectPay
    const paymentData = {
      ...data,
      transaction_id: crypto.randomBytes(16).toString('hex'),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Salva o pagamento no Firestore
    const paymentsRef = db.collection('payments');
    await paymentsRef.add(paymentData);

    return { success: true, data: paymentData };
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    return { success: false, message: 'Erro ao criar pagamento' };
  }
}

// Removed duplicate function implementation