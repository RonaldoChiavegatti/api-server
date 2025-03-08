import { db } from '../lib/firebase';
import { getAuth } from 'firebase-admin/auth';
import { sendCredentialEmail, generateRandomPassword } from './emailService';
    
interface UserCredentials {
  email: string;
  password: string;
  appUsername: string; // será o mesmo que o email
  createdAt: Date;
  expiresAt: Date;
}

export async function generateAndSendCredentials(customerEmail: string, planDuration: number) {
  try {
    const auth = getAuth();
    const appUsername = customerEmail;
    const password = generateRandomPassword(); // Usando a função do emailService
    
    // 1. Criar usuário no Firebase Auth
    try {
      await auth.createUser({
        email: customerEmail,
        password: password,
        emailVerified: false,
      });

      // Definir claims do usuário
      await auth.setCustomUserClaims((await auth.getUserByEmail(customerEmail)).uid, {
        planDuration,
        expiresAt: new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000).getTime(),
        role: 'user'
      });

      console.log('✅ Usuário criado no Firebase Auth');
    } catch (firebaseError) {
      if ((firebaseError as any).code === 'auth/email-already-exists') {
        console.log('⚠️ Usuário já existe, atualizando claims...');
        // Atualizar claims do usuário existente
        await auth.setCustomUserClaims((await auth.getUserByEmail(customerEmail)).uid, {
          planDuration,
          expiresAt: new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000).getTime(),
          role: 'user'
        });
      } else {
        throw firebaseError;
      }
    }

    // 2. Salvar credenciais no Firestore
    const credentials: UserCredentials = {
      email: customerEmail,
      password,
      appUsername,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000)
    };

    await db.collection('appCredentials').doc(customerEmail).set(credentials);
    console.log('✅ Credenciais salvas no Firestore');

    // 3. Enviar email com as credenciais
    const emailResult = await sendCredentialEmail(customerEmail, appUsername, password);
    
    // Log adicional para debug
    console.log('✅ Email enviado para:', customerEmail, 'com resultado:', emailResult);

    return { 
      success: true, 
      message: 'Credenciais geradas e enviadas com sucesso',
      email: customerEmail,
      username: appUsername
    };

  } catch (error) {
    console.error('❌ Erro ao gerar credenciais:', error);
    return { 
      success: false, 
      message: 'Erro ao gerar credenciais',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
