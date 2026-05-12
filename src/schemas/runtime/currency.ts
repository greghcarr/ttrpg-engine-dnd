import { CurrencySchema, type Currency, CURRENCY_KEYS, type CurrencyKey } from '../primitives.js';

export { CurrencySchema, type Currency };
export const CURRENCY_DENOMINATIONS = CURRENCY_KEYS;
export type CurrencyDenomination = CurrencyKey;

const CP_PER_SP = 10;
const CP_PER_EP = 50;
const CP_PER_GP = 100;
const CP_PER_PP = 1000;

const CP_VALUE_BY_DENOMINATION: Readonly<Record<CurrencyDenomination, number>> = {
  cp: 1,
  sp: CP_PER_SP,
  ep: CP_PER_EP,
  gp: CP_PER_GP,
  pp: CP_PER_PP,
};

export const emptyCurrency = (): Currency => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });

export const totalInCopper = (purse: Currency): number =>
  CURRENCY_DENOMINATIONS.reduce(
    (total, denomination) => total + purse[denomination] * CP_VALUE_BY_DENOMINATION[denomination],
    0,
  );

export const addCurrency = (a: Currency, b: Currency): Currency => ({
  cp: a.cp + b.cp,
  sp: a.sp + b.sp,
  ep: a.ep + b.ep,
  gp: a.gp + b.gp,
  pp: a.pp + b.pp,
});

export const subtractCurrency = (a: Currency, b: Currency): Currency => {
  const result: Currency = {
    cp: a.cp - b.cp,
    sp: a.sp - b.sp,
    ep: a.ep - b.ep,
    gp: a.gp - b.gp,
    pp: a.pp - b.pp,
  };
  for (const denomination of CURRENCY_DENOMINATIONS) {
    if (result[denomination] < 0) {
      throw new Error(`Insufficient ${denomination}: have ${a[denomination]}, need ${b[denomination]}`);
    }
  }
  return result;
};
