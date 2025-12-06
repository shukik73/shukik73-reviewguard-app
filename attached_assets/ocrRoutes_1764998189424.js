import { Router } from 'express';
import * as ocrController from '../controllers/ocrController.js';

export default function createOCRRoutes(pool, ocrUpload) {
  const router = Router();

  router.post('/api/ocr/process', ocrUpload.single('image'), ocrController.processOCR(pool));

  return router;
}
