import { Router } from 'express';
import { sendMessage, getStatus, getContacts, clearSession } from '../controllers/whatsappController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePlan } from '../middlewares/requirePlan.js';

const router = Router();

router.use(protect);
router.use(requirePlan(['premium']));
router.get('/status', getStatus);
router.get('/contacts', getContacts);
router.post('/send', sendMessage);
router.post('/clear-session', clearSession);

export default router;
