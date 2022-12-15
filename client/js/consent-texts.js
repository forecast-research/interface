const incentiveHighFirst = {
  estimatedTime: "40",
  estimatedBonus: "5.50",
  endInstructions:
    "At the end of the experiment, we will calculate your total score from part 1 and part 2. In part 1, the bonus you receive will be equal to your total score divided by 400. In part 2, the bonus will be equal to your total score divided by 4,000.",
  partsInstructions:
    "<b>In part 1, the total bonus payment will be $5.00 on average. In part 2, the total bonus payment will be $0.50 on average. In other words, you will perform similar prediction tasks in part 1 and part 2, but the reward for accuracy will be ten times as large in part 1 as we explain more below.</b>",
}

const incentiveLowFirst = {
  estimatedTime: "30",
  estimatedBonus: "5.50",
  endInstructions:
    "At the end of the experiment, we will calculate your total score from part 1 and part 2. In part 1, the bonus you receive will be equal to your total score divided by 4,000. In part 2, the bonus will be equal to your total score divided by 400.",
  partsInstructions:
    "<b>In part 1, the total bonus payment will be $0.50 on average. In part 2, the total bonus payment will be $5.00 on average. In other words, you will perform similar prediction tasks in part 1 and part 2, but the reward for accuracy will be ten times as large in part 2 as we explain more below.</b>",
}

const estimatedBonus2p50 = {
  estimatedBonus: "2.50"
}

const estimatedBonus7p50 = {
  estimatedBonus: "7.50"
}

const basePayment5p00 = {
  basePayment: "5.00"
}


module.exports = {
  C1: { ...estimatedBonus7p50, ...basePayment5p00 },
  C2: { ...estimatedBonus7p50, ...basePayment5p00 },
  C3: { ...estimatedBonus7p50, ...basePayment5p00 },
  C4: { ...estimatedBonus7p50, ...basePayment5p00 },
  E11: estimatedBonus2p50,
  E12: estimatedBonus2p50,
  E13: estimatedBonus2p50,
  E14: estimatedBonus2p50,
  E15: estimatedBonus2p50,
  E16: estimatedBonus2p50,
  E41Low: incentiveLowFirst,
  E42Low: incentiveLowFirst,
  E43Low: incentiveLowFirst,
  E44Low: incentiveLowFirst,
  E45Low: incentiveLowFirst,
  E46Low: incentiveLowFirst,
  E41High: incentiveHighFirst,
  E42High: incentiveHighFirst,
  E43High: incentiveHighFirst,
  E44High: incentiveHighFirst,
  E45High: incentiveHighFirst,
  E46High: incentiveHighFirst,
};
