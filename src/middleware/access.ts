import { Request, Response, NextFunction } from 'express';

export function requirePremiumAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
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
}