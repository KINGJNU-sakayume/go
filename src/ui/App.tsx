import { useState, type ReactElement } from 'react';
import { useGame } from './hooks/useGame';
import { HoverProvider } from './components/Hover';
import { StageScreen } from './screens/StageScreen';
import { OperationModal } from './screens/OperationModal';
import { DeckViewer } from './screens/DeckViewer';
import { CrossroadsScreen, EventScreen, GameOverScreen, RewardScreen, ShopScreen, TitleScreen } from './screens/RunScreens';
import { DebugPanel } from './screens/DebugPanel';
import { CardThemeContext } from './theme/linocut';

const DEBUG = import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

export function App(): ReactElement {
  const game = useGame();
  const [deckOpen, setDeckOpen] = useState(false);
  const run = game.run;
  const openDeck = () => setDeckOpen(true);

  let screen: ReactElement;
  if (!run) screen = <TitleScreen game={game} />;
  else if (run.phase === 'stage' || run.phase === 'stageResult') screen = <StageScreen game={game} openDeck={openDeck} />;
  else if (run.phase === 'reward') screen = <RewardScreen game={game} openDeck={openDeck} />;
  else if (run.phase === 'crossroads') screen = <CrossroadsScreen game={game} openDeck={openDeck} />;
  else if (run.phase === 'shop') screen = <ShopScreen game={game} openDeck={openDeck} />;
  else if (run.phase === 'event') screen = <EventScreen game={game} openDeck={openDeck} />;
  else screen = <GameOverScreen game={game} openDeck={openDeck} />;

  const showOps = !!run && run.ops.length > 0 && run.phase !== 'stage' && run.phase !== 'stageResult';
  return (
    <CardThemeContext.Provider value={game.settings.cardTheme}>
    <HoverProvider>
      {screen}
      {showOps && <OperationModal game={game} />}
      {deckOpen && run && <DeckViewer run={run} onClose={() => setDeckOpen(false)} />}
      <div className="pointer-events-none fixed bottom-3 right-3 z-[95] flex flex-col items-end gap-1">
        {game.toasts.map((t) => (
          <div key={t.id} className="float-up rounded bg-[#1e1512]/95 px-3 py-1.5 text-sm shadow-lg ring-1 ring-amber-200/30">
            {t.text}
          </div>
        ))}
      </div>
      {DEBUG && <DebugPanel game={game} />}
    </HoverProvider>
    </CardThemeContext.Provider>
  );
}
