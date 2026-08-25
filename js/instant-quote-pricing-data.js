/**
 * Instant Quote — pricing tables (edit here when rates change)
 */
(function (global) {
  'use strict';

  global.IQ = global.IQ || {};

  global.IQ.PRICING_DATA = {
    version: '2.0.0',

    garmentPrices: {
      tshirt: { hq: 5.0, premium: 10.0 },
      longsleeve: { hq: 10.0, premium: 15.0 },
      polo: { hq: 15.0, premium: 22.0 },
      crewneck: { hq: 15.0, premium: 22.0 },
      hoodie: { hq: 20.0, premium: 30.0 },
      windbreaker: { hq: 30.0, premium: 42.0 },
      hat: { hq: 10.0, premium: 15.0 }
    },

    /** Sorted ascending by maxQty — first matching bracket wins */
    printMatrix: [
      { maxQty: 99, loc1Base: 6.25, locOtherBase: 2.5, extraInk: 1.25 },
      { maxQty: 149, loc1Base: 5.3, locOtherBase: 2.2, extraInk: 1.05 },
      { maxQty: 199, loc1Base: 4.7, locOtherBase: 1.9, extraInk: 0.95 },
      { maxQty: 249, loc1Base: 4.05, locOtherBase: 1.7, extraInk: 0.8 },
      { maxQty: 449, loc1Base: 3.45, locOtherBase: 1.5, extraInk: 0.7 },
      { maxQty: 999, loc1Base: 2.5, locOtherBase: 1.25, extraInk: 0.5 }
    ],

    /**
     * Tick 5 on Ink Colors = 5+ / Full Color
     * (Simulated Process / DTF / CMYK) — not spot-color screen math.
     */
    fullColor: {
      screensPerLocation: 4,
      /** Multiplier on 4-color spot loc1Base for process/DTF/CMYK loc1 */
      loc1Multiplier: 1.85,
      /** Multiplier on locOtherBase for additional full-color locations */
      locOtherMultiplier: 1.65
    },

    screenSetupFeePerScreen: 25.0,
    agencyMarkupMultiplier: 1.25,
    customArtFee: 250.0,

    /**
     * Hats — embroidery / cap press: ink tick is mostly cosmetic on the quote.
     * Decoration cost is flat per location; extra panels ≈ $5 retail per add-on loc.
     */
    hatPrint: {
      loc1Base: 5.5,
      /** Pre-markup COGS — × agencyMarkup ≈ $5 retail per additional location */
      locOtherBase: 4.0,
      screensPerLocation: 1,
      fullColorLoc1Mult: 1.15,
      fullColorLocOtherMult: 1.1
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
