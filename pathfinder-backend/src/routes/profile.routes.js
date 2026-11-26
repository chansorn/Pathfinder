import express, { Router } from 'express';
import { MAX_AVATAR_BYTES } from '../services/avatar.service.js';
import * as c from '../controllers/profile.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { updateProfileBody, createExamScoreBody } from '../schemas/profile.schema.js';
import { uuidParam } from '../schemas/common.schema.js';

const router = Router();

router.get('/profile', requireAuth, c.getProfile);
router.put('/profile', requireAuth, validate({ body: updateProfileBody }), c.updateProfile);

// raw image body: Content-Type image/png | image/jpeg | image/webp, max 2 MB
const imageBody = express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_AVATAR_BYTES });
router.post('/profile/avatar', requireAuth, imageBody, c.uploadAvatar);
router.delete('/profile/avatar', requireAuth, c.deleteAvatar);

router.get('/exam-scores', requireAuth, c.listExamScores);
router.post('/exam-scores', requireAuth, validate({ body: createExamScoreBody }), c.addExamScore);
router.delete('/exam-scores/:id', requireAuth, validate({ params: uuidParam }), c.deleteExamScore);

export default router;
