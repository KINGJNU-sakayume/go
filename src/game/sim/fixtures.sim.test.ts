import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import '../index';
import { newRun, continueAfterStage, pickReward, chooseCrossroads } from '../engine/run';
import { serializeRun } from '../save/save';
import { botPlayStage } from './bot';
import { addCard, addEnhancement, addMutation, gainTalisman } from '../engine/operations';
import { cloneRun, createStage } from '../engine/stage';

it.skipIf(!process.env.FIXTURE_DIR)('writes UI fixtures', () => {
  const out = process.env.FIXTURE_DIR!;
  let run = newRun('HWATU-FIXT01');
  for (let i = 0; i < 20 && !(run.phase === 'stageResult' && run.stageResult?.cleared); i++) {
    run = botPlayStage(newRun(`HWATU-FIXT${i}`));
  }
  const reward = continueAfterStage(run);
  writeFileSync(`${out}/fx-reward.json`, serializeRun(reward));
  const cross = pickReward(reward, reward.reward!.options[0].id);
  const cross2 = { ...cross, ops: [] };
  writeFileSync(`${out}/fx-cross.json`, serializeRun(cross2));
  const shop = chooseCrossroads(cross2, 'shop');
  shop.coins = 60;
  writeFileSync(`${out}/fx-shop.json`, serializeRun(shop));
  const ev = chooseCrossroads(cross2, cross2.crossroads!.options[1].id);
  ev.coins = 30;
  writeFileSync(`${out}/fx-event.json`, serializeRun(ev));
  // late-game engineered build at December
  const late = cloneRun(newRun('HWATU-LATE01'));
  for (const id of ['m09-ribbon', 'm06-ribbon', 'm10-ribbon']) {
    const base = late.deck.find((c) => c.defId === id)!;
    base.level = 7;
    addEnhancement(base, 'golden');
    addCard(late, id, { level: 4, enhancements: [{ id: 'echo', stacks: 1 }] });
  }
  addMutation(late, late.deck.find((c) => c.defId === 'm09-ribbon')!, { id: 'splitMoon', month: 6 });
  late.deck = late.deck.filter((c, i) => i % 3 !== 0 || /m0(6|9)|m10|joker/.test(c.defId));
  late.jokbo.cheongdan.level = 5;
  late.jokbo.cheongdan.evolutions.push('cheongdan-endless', 'cheongdan-wave');
  for (const t of ['blue-thread', 'blue-wave', 'echo-drum', 'broken-mirror', 'emptying', 'sword-cut', 'chain-knot', 'endless-rite']) gainTalisman(late, t);
  late.deck.find((c) => c.defId === 'joker')!.jokerForm = 'echo';
  createStage(late, 11);
  writeFileSync(`${out}/fx-late.json`, serializeRun(late));
});
