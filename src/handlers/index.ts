import type { HandlerContext } from './context.js';
import type { Event } from '../schemas/events/index.js';

export interface EffectHandler {
  onApply?(ctx: HandlerContext, params: unknown): ReadonlyArray<Event>;
  onTick?(ctx: HandlerContext, params: unknown, trigger: Event): ReadonlyArray<Event>;
  onExpire?(ctx: HandlerContext, params: unknown): ReadonlyArray<Event>;
}

export interface HandlerRegistry {
  readonly effect?: Readonly<Record<string, EffectHandler>>;
}

export type { HandlerContext } from './context.js';
