import * as admin from 'firebase-admin';
import { PlanType, AccessLevel, PLAN_FEATURES, PLAN_DURATION } from '../types/auth';
import { db } from '../lib/firebase';

export async function generateUserPlan(
  userId: string,
  planType: PlanType,
  email: string,
  name: string,
  phone: string
) {
  try {
    const userRef = db.collection('users').doc(userId);
    const planDuration = PLAN_DURATION[planType];
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + planDuration);

    const userData = {
      uid: userId,
      email,
      name,
      phone,
      plan: planType,
      accessLevel: AccessLevel.FULL,
      planExpiration: admin.firestore.Timestamp.fromDate(expirationDate),
      features: PLAN_FEATURES, // Todas as features para todos os planos
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      planDuration: planDuration
    };

    await userRef.set(userData);
    return { success: true, data: userData };
  } catch (error) {
    console.error('Erro ao gerar plano do usuário:', error);
    return { success: false, message: 'Erro ao gerar plano' };
  }
}

// Simplificar verificação de acesso - todos têm acesso completo
export async function checkPlanAccess(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;

    const userData = userDoc.data();
    if (!userData) return false;

    // Verifica apenas se o plano está ativo baseado na data de expiração
    const isActive = new Date() < userData.planExpiration.toDate();
    return isActive;
  } catch (error) {
    console.error('Erro ao verificar acesso:', error);
    return false;
  }
}

export async function getPlanStatus(userId: string) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { success: false, message: 'Usuário não encontrado' };
    }

    const userData = userDoc.data();
    if (!userData) {
      return { success: false, message: 'Dados do usuário não encontrados' };
    }

    const isActive = new Date() < userData.planExpiration.toDate();
    const daysRemaining = Math.ceil(
      (userData.planExpiration.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      success: true,
      data: {
        plan: userData.plan,
        accessLevel: userData.accessLevel,
        isActive,
        daysRemaining,
        features: userData.features,
        expirationDate: userData.planExpiration.toDate()
      }
    };
  } catch (error) {
    console.error('Erro ao obter status do plano:', error);
    return { success: false, message: 'Erro ao obter status do plano' };
  }
}