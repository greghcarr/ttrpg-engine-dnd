import type { Campaign, CampaignState, Engine, Event } from 'ttrpg-engine-dnd';

// The shape of intents the demo dispatch loop knows about. Each variant
// is a discriminated record keyed by `kind`; the host translates it
// into an `engine.plan.<method>` call. Hard-coded action set per step
// 5 of the build order — no generic dispatch table.
export type Intent =
  | { kind: 'dodge'; combatantId: string }
  | { kind: 'dash'; combatantId: string }
  | { kind: 'move'; combatantId: string; to: { x: number; y: number } }
  | { kind: 'attack'; attackerId: string; targetId: string; weaponInstanceId: string }
  | { kind: 'opportunityAttack'; reactorId: string; targetId: string; weaponInstanceId: string }
  | { kind: 'advanceTurn'; encounterId: string }
  | { kind: 'resolveChoice'; choiceId: string; characterId: string; selectedOptionIds: ReadonlyArray<string> }
  | { kind: 'commit'; events: ReadonlyArray<Event> };

export interface DispatchResult {
  readonly events: ReadonlyArray<Event>;
}

export type Subscriber = (campaign: Campaign) => void;

export interface EngineHost {
  dispatch(intent: Intent): DispatchResult;
  subscribe(fn: Subscriber): () => void;
  getCampaign(): Campaign;
  getState(): CampaignState;
  /**
   * Replace the live campaign wholesale and notify subscribers. Used
   * by the Event Inspector's Import flow to swap in a loaded campaign
   * without unmounting/remounting any of the views.
   */
  replaceCampaign(next: Campaign): void;
}

export const createEngineHost = (engine: Engine, initial: Campaign): EngineHost => {
  let campaign: Campaign = initial;
  const subscribers = new Set<Subscriber>();

  const notify = (): void => {
    for (const fn of subscribers) fn(campaign);
  };

  const planFor = (intent: Intent): ReadonlyArray<Event> => {
    switch (intent.kind) {
      case 'dodge':
        return engine.plan.dodge(campaign.state, { combatantId: intent.combatantId }).events;
      case 'dash':
        return engine.plan.dash(campaign.state, { combatantId: intent.combatantId }).events;
      case 'move':
        return engine.plan.move(campaign.state, { combatantId: intent.combatantId, to: intent.to }).events;
      case 'attack':
        return engine.plan.attack(campaign.state, {
          attackerId: intent.attackerId,
          targetId: intent.targetId,
          weaponInstanceId: intent.weaponInstanceId,
        }).events;
      case 'opportunityAttack':
        return engine.plan.opportunityAttack(campaign.state, {
          reactorId: intent.reactorId,
          targetId: intent.targetId,
          weaponInstanceId: intent.weaponInstanceId,
        }).events;
      case 'advanceTurn':
        return engine.plan.advanceTurn(campaign.state, { encounterId: intent.encounterId }).events;
      case 'resolveChoice':
        return engine.plan.resolveChoice(campaign.state, {
          choiceId: intent.choiceId,
          characterId: intent.characterId,
          selectedOptionIds: intent.selectedOptionIds,
        }).events;
      case 'commit':
        return intent.events;
    }
  };

  return {
    dispatch(intent) {
      const events = planFor(intent);
      campaign = engine.commit(campaign, events);
      notify();
      return { events };
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    getCampaign() {
      return campaign;
    },
    getState() {
      return campaign.state;
    },
    replaceCampaign(next) {
      campaign = next;
      notify();
    },
  };
};
