import starterPackJson from './starter-pack.json';
import { loadContentPack, type ContentPack } from '../pack.js';

export const STARTER_PACK_RAW: unknown = starterPackJson;

export const loadStarterPack = (): ContentPack => loadContentPack(starterPackJson);
