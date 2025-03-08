import express from 'express';
import { generateAndSendCredentials } from '../services/credentialService';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { email, planDuration } = req.body;
  
  if (!email || !planDuration) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email e duração do plano são obrigatórios' 
    });
  }

  const result = await generateAndSendCredentials(email, planDuration);
  
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(500).json(result);
  }
});

export default router;
