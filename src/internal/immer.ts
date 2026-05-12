import type { Draft } from 'immer';
import { enableMapSet, freeze, produce } from 'immer';

enableMapSet();

export const immerProduce = <T>(state: T, recipe: (draft: Draft<T>) => void): T =>
  produce(state, recipe);

export const immerFreeze = <T>(value: T): T => freeze(value, true) as T;
