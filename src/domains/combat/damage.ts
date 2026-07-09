/**
 * Armor formula (preserved from GameEngine):
 * armor absorbs min(armor, dmg * 0.5), then dmg -= absorbed * 0.5, then hp -= dmg.
 */
export function applyDamage(
  target: { hp: number; armor: number },
  damage: number,
): { hp: number; armor: number; absorbed: number } {
  let dmg = damage;
  let armor = target.armor;
  let hp = target.hp;
  let absorbed = 0;

  if (armor > 0) {
    absorbed = Math.min(armor, dmg * 0.5);
    armor -= absorbed;
    dmg -= absorbed * 0.5;
  }

  hp -= dmg;
  return { hp, armor, absorbed };
}

export function isDead(hp: number): boolean {
  return hp <= 0;
}
