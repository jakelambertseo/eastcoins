(() => {
  "use strict";

  function normalize(price) {
    const value = Number(price);
    return Number.isFinite(value) && value !== 0 ? value : null;
  }

  function format(price) {
    const value = normalize(price);
    if (value == null) return "—";
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }

  function parse(value) {
    const match = String(value ?? "")
      .replace(/[−–—]/g, "-")
      .match(/[+-]?\d+(?:\.\d+)?/);

    return match ? normalize(match[0]) : null;
  }

  function toDecimal(price) {
    const value = normalize(price);
    if (value == null) return null;

    return value > 0
      ? 1 + value / 100
      : 1 + 100 / Math.abs(value);
  }

  function payout(wager, price) {
    const amount = Math.max(0, Math.floor(Number(wager) || 0));
    const moneyline = normalize(price);
    const decimal = toDecimal(moneyline);

    if (amount < 1 || moneyline == null || decimal == null) {
      return {
        available: false,
        wager: amount,
        moneyline,
        decimal: null,
        totalReturn: 0,
        profit: 0
      };
    }

    // ZCoins are whole-number currency: round the final total return.
    const totalReturn = Math.max(amount, Math.round(amount * decimal));

    return {
      available: true,
      wager: amount,
      moneyline,
      decimal,
      totalReturn,
      profit: totalReturn - amount
    };
  }

  window.EastcoinMoneyline = Object.freeze({
    normalize,
    format,
    parse,
    toDecimal,
    payout
  });
})();
