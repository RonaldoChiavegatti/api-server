import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';

// Rate limiting para prevenir ataques de força bruta
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para webhooks
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 1000, // limite de 1000 requisições por IP
  message: 'Limite de webhooks excedido, tente novamente em 1 hora',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de segurança básica
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.perfectpay.com.br"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Validação de dados do webhook
export const validateWebhookData = [
  body('event').isString().notEmpty(),
  body('transaction_id').isString().notEmpty(),
  body('status').isString().notEmpty(),
  body('amount').isNumeric(),
  body('customer').isObject(),
  body('customer.name').isString().notEmpty(),
  body('customer.email').isEmail(),
  body('customer.phone').isString().notEmpty(),
  body('product').isObject(),
  body('product.name').isString().notEmpty(),
  body('product.price').isNumeric(),
  body('payment').isObject(),
  body('payment.method').isString().notEmpty(),
  body('payment.status').isString().notEmpty(),
  body('payment.date').isISO8601(),
];

// Middleware para verificar resultados da validação
export const checkValidation = (req: Request, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }
  return next();
};

// Middleware para verificar assinatura do webhook
export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction): Response | void => {
  const signature = req.headers['x-perfectpay-signature'];
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Assinatura do webhook não fornecida'
    });
  }
  return next();
};

// Middleware para logging de requisições
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
};

export function validateInput(res: Response, next: NextFunction) {
  try {
    // sua lógica de validação
    return next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }
}

export function checkPermissions(res: Response, next: NextFunction) {
  try {
    // sua lógica de permissões
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}

export function errorHandler(err: Error, res: Response) {
  return res.status(500).json({ error: err.message });
}