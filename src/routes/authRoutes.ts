import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, updateAiSettings, upgradePlan, cancelPlan } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Strict rate limit for authentication routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  message: { message: 'Too many authentication attempts, please try again after 15 minutes' }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protect as any, getMe);
router.put('/ai-settings', protect as any, updateAiSettings);
router.post('/upgrade-plan', protect as any, upgradePlan);
router.post('/cancel-plan', protect as any, cancelPlan);

export default router;
