export type DiceRollResult = {
    rolls: number[];
    diceTotal: number;
    modifier: number;
    total: number;
};

export function rollDice(
    numberOfDice: number,
    sidesPerDie: number,
    modifier = 0
): DiceRollResult {
    if (!Number.isInteger(numberOfDice) || numberOfDice <= 0) {
        throw new Error("Number of dice must be a positive integer.");
    }

    if (!Number.isInteger(sidesPerDie) || sidesPerDie <= 0) {
        throw new Error("Sides per die must be a positive integer.");
    }

    const rolls = Array.from(
        { length: numberOfDice },
        () => Math.floor(Math.random() * sidesPerDie) + 1
    );

    const diceTotal = rolls.reduce((sum, roll) => sum + roll, 0);

    return {
        rolls,
        diceTotal,
        modifier,
        total: diceTotal + modifier
    };
}
