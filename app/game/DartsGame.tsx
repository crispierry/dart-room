"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DartboardScene, type DartboardSceneHandle } from "./DartboardScene";
import {
  CRICKET_TARGETS,
  applyCricketHit,
  applyThreeOhOneHit,
  chooseAiTarget,
  createCricketMarks,
  createSeededRandom,
  describeMarks,
  formatMark,
  hasClosedCricket,
  isCricketTarget,
  makeAiImpact,
  targetCoordinates,
  type CricketMarks,
  type Difficulty,
  type GameMode,
  type HitResult,
} from "./lib/darts";
import styles from "./game.module.css";

type Opponent = "solo" | "cpu" | "local";
type Phase = "menu" | "playing" | "complete";

type GameConfig = Readonly<{
  mode: GameMode;
  opponent: Opponent;
  difficulty: Difficulty;
  doubleOut: boolean;
  playerOneName: string;
  playerTwoName: string;
}>;

type Player = Readonly<{
  id: string;
  name: string;
  isCpu: boolean;
  color: string;
  score: number;
  marks: CricketMarks;
  dartsThrown: number;
  bestDart: number;
}>;

const INITIAL_CONFIG: GameConfig = Object.freeze({
  mode: "countup",
  opponent: "cpu",
  difficulty: "pub",
  doubleOut: true,
  playerOneName: "Player 1",
  playerTwoName: "Player 2",
});

const PLAYER_COLORS = ["#77ead5", "#ff7567"] as const;
const ROUND_LIMITS: Partial<Record<GameMode, number>> = { countup: 8 };
const AIM_PRESETS = [
  { value: "T20", label: "Triple 20", base: 20, multiplier: 3 as const },
  { value: "T19", label: "Triple 19", base: 19, multiplier: 3 as const },
  { value: "D20", label: "Double 20", base: 20, multiplier: 2 as const },
  { value: "D16", label: "Double 16", base: 16, multiplier: 2 as const },
  { value: "BULL", label: "Bullseye", base: 25, multiplier: 2 as const },
] as const;

function newPlayers(config: GameConfig): readonly Player[] {
  const initialScore = config.mode === "301" ? 301 : 0;
  const playerOne: Player = {
    id: "p1",
    name: config.playerOneName.trim() || "Player 1",
    isCpu: false,
    color: PLAYER_COLORS[0],
    score: initialScore,
    marks: createCricketMarks(),
    dartsThrown: 0,
    bestDart: 0,
  };
  if (config.opponent === "solo") return [playerOne];
  return [
    playerOne,
    {
      id: "p2",
      name: config.opponent === "cpu" ? `${config.difficulty === "pro" ? "The House" : config.difficulty === "pub" ? "Casey" : "Rookie Bot"}` : config.playerTwoName.trim() || "Player 2",
      isCpu: config.opponent === "cpu",
      color: PLAYER_COLORS[1],
      score: initialScore,
      marks: createCricketMarks(),
      dartsThrown: 0,
      bestDart: 0,
    },
  ];
}

function modeTitle(mode: GameMode): string {
  if (mode === "countup") return "Count Up";
  if (mode === "301") return "301";
  return "Cricket";
}

function modeDescription(mode: GameMode): string {
  if (mode === "countup") return "Eight rounds. Highest total wins.";
  if (mode === "301") return "Race from 301 to exactly zero.";
  return "Close 15–20 and bull, then outscore your rival.";
}

function scoreLabel(mode: GameMode, player: Player): string {
  if (mode === "cricket") return `${player.score} pts`;
  return String(player.score);
}

function playHitSound(hit: HitResult, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = hit.ring === "bull" || hit.ring === "triple" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(hit.score === 0 ? 90 : 170 + hit.score * 4.2, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
  oscillator.addEventListener("ended", () => void context.close());
}

function winnerFor(mode: GameMode, players: readonly Player[]): Player {
  if (mode === "301") return players.find((player) => player.score === 0) ?? players[0];
  if (mode === "cricket") {
    return [...players].sort((a, b) => {
      const closedDifference = Number(hasClosedCricket(b.marks)) - Number(hasClosedCricket(a.marks));
      return closedDifference || b.score - a.score;
    })[0];
  }
  return [...players].sort((a, b) => b.score - a.score)[0];
}

export function DartsGame() {
  const sceneRef = useRef<DartboardSceneHandle>(null);
  const endTurnTimerRef = useRef<number | null>(null);
  const aiTimerRef = useRef<number | null>(null);
  const randomRef = useRef(createSeededRandom(0x4d3c2b1a));
  const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
  const [phase, setPhase] = useState<Phase>("menu");
  const [players, setPlayers] = useState<readonly Player[]>(() => newPlayers(INITIAL_CONFIG));
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [dartsInVisit, setDartsInVisit] = useState(0);
  const [visitStartScore, setVisitStartScore] = useState(0);
  const [visitHits, setVisitHits] = useState<readonly HitResult[]>([]);
  const [lastHit, setLastHit] = useState<HitResult | null>(null);
  const [announcement, setAnnouncement] = useState("Choose a game mode to begin.");
  const [resolving, setResolving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aimPreset, setAimPreset] = useState<(typeof AIM_PRESETS)[number]["value"]>("T20");
  const [shareStatus, setShareStatus] = useState("");
  const [highScore, setHighScore] = useState(0);

  const activePlayer = players[activePlayerIndex] ?? players[0];
  const winner = phase === "complete" ? winnerFor(config.mode, players) : null;
  const roundLimit = ROUND_LIMITS[config.mode];
  const canHumanThrow = phase === "playing" && !resolving && !activePlayer?.isCpu;

  useEffect(() => {
    const stored = window.localStorage.getItem("dart-room-countup-high-score");
    const syncStoredScore = window.requestAnimationFrame(() => {
      if (stored) setHighScore(Number(stored) || 0);
    });
    return () => {
      window.cancelAnimationFrame(syncStoredScore);
      if (endTurnTimerRef.current !== null) window.clearTimeout(endTurnTimerRef.current);
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    };
  }, []);

  const finishGame = useCallback((nextPlayers: readonly Player[]) => {
    if (config.mode === "countup") {
      const bestHuman = Math.max(...nextPlayers.filter((player) => !player.isCpu).map((player) => player.score));
      if (bestHuman > highScore) {
        setHighScore(bestHuman);
        window.localStorage.setItem("dart-room-countup-high-score", String(bestHuman));
      }
    }
    setPlayers(nextPlayers);
    setResolving(false);
    setPhase("complete");
    const nextWinner = winnerFor(config.mode, nextPlayers);
    setAnnouncement(`${nextWinner.name} wins ${modeTitle(config.mode)}.`);
  }, [config.mode, highScore]);

  const advanceTurn = useCallback((nextPlayers: readonly Player[]) => {
    sceneRef.current?.clearDarts();
    const nextIndex = (activePlayerIndex + 1) % nextPlayers.length;
    const completesRound = nextIndex === 0;
    const nextRound = completesRound ? round + 1 : round;

    if (config.mode === "countup" && completesRound && round >= 8) {
      finishGame(nextPlayers);
      return;
    }

    setPlayers(nextPlayers);
    setActivePlayerIndex(nextIndex);
    setRound(nextRound);
    setDartsInVisit(0);
    setVisitHits([]);
    setVisitStartScore(nextPlayers[nextIndex].score);
    setResolving(false);
    setAnnouncement(`${nextPlayers[nextIndex].name}, your throw.`);
  }, [activePlayerIndex, config.mode, finishGame, round]);

  const scheduleAdvance = useCallback((nextPlayers: readonly Player[], delay = 1050) => {
    setResolving(true);
    if (endTurnTimerRef.current !== null) window.clearTimeout(endTurnTimerRef.current);
    endTurnTimerRef.current = window.setTimeout(() => advanceTurn(nextPlayers), delay);
  }, [advanceTurn]);

  const handleHit = useCallback((hit: HitResult) => {
    if (phase !== "playing" || resolving) return;
    playHitSound(hit, soundEnabled);

    const player = players[activePlayerIndex];
    if (!player) return;
    const nextPlayers = [...players];
    let nextPlayer: Player = {
      ...player,
      dartsThrown: player.dartsThrown + 1,
      bestDart: Math.max(player.bestDart, hit.score),
    };
    let bust = false;
    let won = false;
    let message = `${player.name}: ${hit.label}`;

    if (config.mode === "countup") {
      nextPlayer = { ...nextPlayer, score: nextPlayer.score + hit.score };
    } else if (config.mode === "301") {
      const result = applyThreeOhOneHit(player.score, visitStartScore, hit, config.doubleOut);
      bust = result.bust;
      won = result.won;
      nextPlayer = { ...nextPlayer, score: result.score };
      if (bust) {
        message = `${player.name} busts. Score returns to ${visitStartScore}.`;
      }
    } else if (isCricketTarget(hit.base)) {
      const canScore = players.some((opponent, index) =>
        index !== activePlayerIndex && (opponent.marks[hit.base] ?? 0) < 3,
      );
      const result = applyCricketHit(player.marks, player.score, hit.base, hit.multiplier, canScore);
      const marks = result.marks[hit.base] ?? 0;
      nextPlayer = {
        ...nextPlayer,
        score: result.score,
        marks: result.marks,
      };
      const opponents = players.filter((_, index) => index !== activePlayerIndex);
      won = hasClosedCricket(nextPlayer.marks)
        && (opponents.length === 0 || nextPlayer.score >= Math.max(...opponents.map((opponent) => opponent.score)));
      message = result.overflow > 0 && canScore
        ? `${player.name}: ${hit.label}, plus ${result.overflow * hit.base} cricket points.`
        : `${player.name}: ${hit.label}. ${hit.base === 25 ? "Bull" : hit.base} is ${describeMarks(marks).toLowerCase()}.`;
    }

    nextPlayers[activePlayerIndex] = nextPlayer;
    const nextDarts = dartsInVisit + 1;
    setPlayers(nextPlayers);
    setDartsInVisit(nextDarts);
    setVisitHits((current) => [...current, hit]);
    setLastHit(hit);
    setAnnouncement(message);

    if (won) {
      setResolving(true);
      endTurnTimerRef.current = window.setTimeout(() => finishGame(nextPlayers), 900);
    } else if (bust || nextDarts >= 3) {
      scheduleAdvance(nextPlayers, bust ? 1150 : 980);
    }
  }, [
    activePlayerIndex,
    config.doubleOut,
    config.mode,
    dartsInVisit,
    finishGame,
    phase,
    players,
    resolving,
    scheduleAdvance,
    soundEnabled,
    visitStartScore,
  ]);

  useEffect(() => {
    if (phase !== "playing" || resolving || !activePlayer?.isCpu) return;
    const playerForAi = { score: activePlayer.score, marks: activePlayer.marks };
    const opponents = players
      .filter((_, index) => index !== activePlayerIndex)
      .map((player) => ({ score: player.score, marks: player.marks }));
    const target = chooseAiTarget(config.mode, playerForAi, opponents);
    const impact = makeAiImpact(target, config.difficulty, randomRef.current);
    aiTimerRef.current = window.setTimeout(() => {
      sceneRef.current?.throwAt(impact.x, impact.y, activePlayer.color);
    }, dartsInVisit === 0 ? 820 : 620);
    return () => {
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    };
  }, [activePlayer, activePlayerIndex, config.difficulty, config.mode, dartsInVisit, phase, players, resolving]);

  function startGame() {
    const nextPlayers = newPlayers(config);
    if (endTurnTimerRef.current !== null) window.clearTimeout(endTurnTimerRef.current);
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    sceneRef.current?.clearDarts();
    randomRef.current = createSeededRandom(Date.now());
    setPlayers(nextPlayers);
    setActivePlayerIndex(0);
    setRound(1);
    setDartsInVisit(0);
    setVisitHits([]);
    setVisitStartScore(nextPlayers[0].score);
    setLastHit(null);
    setResolving(false);
    setPhase("playing");
    setAnnouncement(`${nextPlayers[0].name}, your throw.`);
  }

  function returnToMenu() {
    if (endTurnTimerRef.current !== null) window.clearTimeout(endTurnTimerRef.current);
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    sceneRef.current?.clearDarts();
    setResolving(false);
    setPhase("menu");
    setAnnouncement("Choose a game mode to begin.");
  }

  function throwPreset() {
    if (!canHumanThrow) return;
    const preset = AIM_PRESETS.find((item) => item.value === aimPreset) ?? AIM_PRESETS[0];
    const target = targetCoordinates(preset);
    const wobble = 0.045;
    sceneRef.current?.throwAt(
      target.x + (randomRef.current() - 0.5) * wobble,
      target.y + (randomRef.current() - 0.5) * wobble,
      activePlayer.color,
    );
  }

  async function shareGame() {
    const shareData = {
      title: "Dart Room",
      text: `Can you beat my ${highScore || "best"} score in Dart Room?`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Share sheet opened");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Game link copied");
      }
    } catch {
      setShareStatus("");
    }
    window.setTimeout(() => setShareStatus(""), 2200);
  }

  const visitTotal = useMemo(() => visitHits.reduce((total, hit) => total + hit.score, 0), [visitHits]);

  return (
    <main className={styles.gamePage}>
      <header className={styles.gameHeader}>
        <div className={styles.gameBrand} aria-label="Dart Room">
          <span className={styles.brandTarget} aria-hidden="true"><i /></span>
          <span>Dart Room</span>
          <small>3D browser darts</small>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => setSoundEnabled((value) => !value)} aria-pressed={soundEnabled}>
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
          <button type="button" onClick={() => void shareGame()}>Share game</button>
        </div>
      </header>

      <div className={styles.gameGrid}>
        <section className={styles.playStage} aria-label="Darts playing area">
          <div className={styles.stageTopline}>
            <span>{phase === "menu" ? "Free play" : modeTitle(config.mode)}</span>
            <span>{phase === "playing" ? `Round ${round}${roundLimit ? ` / ${roundLimit}` : ""}` : "Swipe to throw"}</span>
          </div>
          <DartboardScene
            ref={sceneRef}
            disabled={!canHumanThrow}
            playerColor={activePlayer?.color ?? PLAYER_COLORS[0]}
            onHit={handleHit}
          />
          <div className={styles.ambientStatus}>
            <i aria-hidden="true" />
            {phase === "menu" ? "Board calibrated" : resolving ? "Collecting darts" : `${activePlayer?.name ?? "Player"} at the oche`}
          </div>
        </section>

        <aside className={styles.gamePanel}>
          {phase === "menu" ? (
            <div className={styles.setupPanel}>
              <p className={styles.kicker}>A real browser darts game</p>
              <h1>Step up to the oche.</h1>
              <p className={styles.setupIntro}>Pick a match, flick a dart, and make the board sing. No download and no account.</p>

              <fieldset className={styles.modePicker}>
                <legend>Game</legend>
                {(["countup", "301", "cricket"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={config.mode === mode ? styles.selectedOption : ""}
                    onClick={() => setConfig((current) => ({ ...current, mode }))}
                    aria-pressed={config.mode === mode}
                  >
                    <b>{modeTitle(mode)}</b>
                    <span>{modeDescription(mode)}</span>
                  </button>
                ))}
              </fieldset>

              <fieldset className={styles.playerPicker}>
                <legend>Play</legend>
                {(["solo", "cpu", "local"] as const).map((opponent) => (
                  <button
                    key={opponent}
                    type="button"
                    className={config.opponent === opponent ? styles.selectedOption : ""}
                    onClick={() => setConfig((current) => ({ ...current, opponent }))}
                    aria-pressed={config.opponent === opponent}
                  >
                    {opponent === "solo" ? "Solo" : opponent === "cpu" ? "Vs CPU" : "Two players"}
                  </button>
                ))}
              </fieldset>

              <div className={styles.nameFields}>
                <label>
                  Your name
                  <input
                    value={config.playerOneName}
                    maxLength={18}
                    onChange={(event) => setConfig((current) => ({ ...current, playerOneName: event.target.value }))}
                  />
                </label>
                {config.opponent === "local" ? (
                  <label>
                    Friend&apos;s name
                    <input
                      value={config.playerTwoName}
                      maxLength={18}
                      onChange={(event) => setConfig((current) => ({ ...current, playerTwoName: event.target.value }))}
                    />
                  </label>
                ) : null}
              </div>

              {config.opponent === "cpu" ? (
                <label className={styles.difficultyRow}>
                  CPU level
                  <select
                    value={config.difficulty}
                    onChange={(event) => setConfig((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}
                  >
                    <option value="rookie">Rookie</option>
                    <option value="pub">Pub regular</option>
                    <option value="pro">The House</option>
                  </select>
                </label>
              ) : null}

              {config.mode === "301" ? (
                <label className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={config.doubleOut}
                    onChange={(event) => setConfig((current) => ({ ...current, doubleOut: event.target.checked }))}
                  />
                  <span><b>Double out</b><small>Finish on a double or bull</small></span>
                </label>
              ) : null}

              <button className={styles.startButton} type="button" onClick={startGame}>
                Start {modeTitle(config.mode)} <span>→</span>
              </button>
              <div className={styles.personalBest}><span>Personal best</span><b>{highScore || "—"}</b><small>Count Up · this device</small></div>
            </div>
          ) : (
            <div className={styles.matchPanel}>
              <div className={styles.matchHeading}>
                <div>
                  <p className={styles.kicker}>{modeTitle(config.mode)} match</p>
                  <h1>{phase === "complete" ? "Game over" : "Match live"}</h1>
                </div>
                <button type="button" onClick={returnToMenu}>Exit</button>
              </div>

              <div className={styles.scoreboard} aria-label="Scoreboard">
                {players.map((player, index) => (
                  <article
                    key={player.id}
                    className={index === activePlayerIndex && phase === "playing" ? styles.activeScore : ""}
                    style={{ "--player-color": player.color } as CSSProperties}
                  >
                    <span>{player.isCpu ? "CPU" : `P${index + 1}`} · {index === activePlayerIndex && phase === "playing" ? "THROWING" : "READY"}</span>
                    <div><b>{player.name}</b><strong>{scoreLabel(config.mode, player)}</strong></div>
                    <small>{player.dartsThrown} darts · best {player.bestDart}</small>
                  </article>
                ))}
              </div>

              {config.mode === "cricket" ? (
                <div
                  className={styles.cricketTable}
                  role="table"
                  aria-label="Cricket marks"
                  style={{ "--cricket-players": players.length } as CSSProperties}
                >
                  <div role="row"><span role="columnheader">Target</span>{players.map((player) => <b role="columnheader" key={player.id}>{player.name}</b>)}</div>
                  {CRICKET_TARGETS.map((target) => (
                    <div role="row" key={target}>
                      <span role="rowheader">{target === 25 ? "Bull" : target}</span>
                      {players.map((player) => <b role="cell" key={player.id} aria-label={`${player.name}: ${describeMarks(player.marks[target] ?? 0)}`}>{formatMark(player.marks[target] ?? 0)}</b>)}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={styles.visitCard}>
                <div><span>This visit</span><strong>{visitTotal}</strong></div>
                <div className={styles.dartSlots} aria-label={`${dartsInVisit} of 3 darts thrown`}>
                  {[0, 1, 2].map((index) => (
                    <i key={index} className={index < dartsInVisit ? styles.usedDart : ""}>{visitHits[index]?.score ?? "·"}</i>
                  ))}
                </div>
                <p>{lastHit ? lastHit.label : "Three darts. Make them count."}</p>
              </div>

              <div className={styles.accessibleThrow}>
                <label htmlFor="aim-preset">Keyboard aim</label>
                <div>
                  <select id="aim-preset" value={aimPreset} onChange={(event) => setAimPreset(event.target.value as typeof aimPreset)} disabled={!canHumanThrow}>
                    {AIM_PRESETS.map((preset) => <option value={preset.value} key={preset.value}>{preset.label}</option>)}
                  </select>
                  <button type="button" onClick={throwPreset} disabled={!canHumanThrow}>Throw</button>
                </div>
                <small>Use this control if dragging is difficult.</small>
              </div>

              <div className={styles.rulesNote}>
                <b>How to play</b>
                <p>{modeDescription(config.mode)} Drag upward, release over your target, and use three darts per visit.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {phase === "complete" && winner ? (
        <div className={styles.resultBackdrop} role="presentation">
          <section className={styles.resultCard} role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className={styles.confetti} aria-hidden="true">✦ · ✧ · ✦</div>
            <p className={styles.kicker}>Match complete</p>
            <h2 id="result-title">{winner.name} wins.</h2>
            <p>{config.mode === "countup" ? `${winner.score} points after eight rounds.` : config.mode === "301" ? `${winner.dartsThrown} darts to check out.` : `${winner.score} points with every cricket target closed.`}</p>
            <div className={styles.resultActions}>
              <button className={styles.startButton} type="button" onClick={startGame}>Play again <span>↻</span></button>
              <button type="button" onClick={returnToMenu}>Change game</button>
              <button type="button" onClick={() => void shareGame()}>Challenge a friend</button>
            </div>
          </section>
        </div>
      ) : null}

      <div className={styles.liveRegion} aria-live="polite">{announcement}</div>
      {shareStatus ? <div className={styles.shareToast} role="status">{shareStatus}</div> : null}
    </main>
  );
}
