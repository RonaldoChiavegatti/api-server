import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  debug: true
});

// Log imediato das configurações
console.log('📧 Configurações de email:', {
  host: 'smtp.hostinger.com',
  port: 465,
  user: process.env.EMAIL_USER
});

// Log de verificação da conexão
transporter.verify(function (error, _success) {
  if (error) {
    console.error('❌ Erro na configuração de email:', error);
  } else {
    console.log('✅ Servidor de email pronto!');
  }
});

export async function sendCredentialEmail(
  email: string, 
  username: string, 
  password: string
): Promise<boolean> {
  try {
    console.log('📧 Preparando email para:', email);

    const emailText = `Bem-vindo ao App Queima!

Aqui estão suas credenciais de acesso:

Username/Email: ${username}
Senha: ${password}

Recomendamos que você altere sua senha no primeiro acesso.

IMPORTANTE: Acesse a plataforma através do link:
https://secaexpress.io/login

Atenciosamente,
Equipe App Queima`;

    const mailOptions = {
      from: {
        name: 'App Queima',
        address: 'suporte@queimadefinitiva.shop'
      },
      to: email,
      subject: 'Suas credenciais de acesso - App Queima',
      text: emailText
    };

    console.log('📧 Enviando email com link da plataforma');
    const info = await transporter.sendMail(mailOptions);

    console.log('📧 Resposta do servidor SMTP:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });

    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

export function generateRandomPassword(): string {
  return Math.random().toString(36).slice(-8);
}
