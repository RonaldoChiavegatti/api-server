import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { AuthenticatedUser, AccessLevel } from '../types/auth';
import { db } from '../lib/firebase';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token não fornecido' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.status(401).json({ message: 'Token inválido' });
      return;
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const userRecord = await getAuth().getUser(decodedToken.uid);

    if (!userRecord.email) {
      res.status(401).json({ message: 'Usuário sem email verificado' });
      return;
    }

    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      phone: userRecord.phoneNumber || '',
      name: userRecord.displayName || '',
      plan: userRecord.customClaims?.plan || null,
      accessLevel: userRecord.customClaims?.accessLevel || AccessLevel.FULL,
      planExpiration: userRecord.customClaims?.planExpiration ? new Date(userRecord.customClaims.planExpiration) : new Date(),
      createdAt: new Date(userRecord.metadata.creationTime || Date.now()),
      updatedAt: new Date(userRecord.metadata.lastSignInTime || Date.now())
    };

    next();
  } catch (error) {
    res.status(401).json({ 
      message: 'Token inválido ou expirado',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

export const requirePremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    if (req.user.planExpiration && new Date() > new Date(req.user.planExpiration)) {
      return res.status(403).json({ message: 'Assinatura expirada' });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ 
      message: 'Erro ao verificar acesso',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};

export function checkAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Usuário não autenticado' });
    return;
  }
  next();
}

// Middleware para verificar se o plano está ativo
export function checkActivePlan(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Usuário não autenticado' });
    return;
  }

  const now = new Date();
  if (now > req.user.planExpiration) {
    res.status(403).json({ 
      success: false,
      message: 'Plano expirado',
      expiredAt: req.user.planExpiration
    });
    return;
  }

  next();
}

// Middleware para verificar acesso a recursos específicos
export function checkResourceAccess(resourceId: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }

    try {
      // Verificar se o recurso existe e se o usuário tem acesso
      const resourceRef = await db.collection('resources').doc(resourceId).get();
      
      if (!resourceRef.exists) {
        res.status(404).json({ message: 'Recurso não encontrado' });
        return;
      }

      const resource = resourceRef.data();
      
      if (resource?.userId !== req.user.uid) {
        res.status(403).json({ message: 'Acesso negado a este recurso' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ 
        message: 'Erro ao verificar acesso ao recurso',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };
}