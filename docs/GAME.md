# Game rules and controls

Dart Room is a self-contained WebGL darts game for solo practice, shared-device two-player matches, and CPU opponents. It does not require an account, networked match state, or a download.

## Start a match

1. Choose Count Up, 301, or Cricket.
2. Choose Solo, Vs CPU, or Two players.
3. Enter player names when desired.
4. For CPU play, choose Rookie, Pub regular, or The House.
5. In 301, decide whether Double out is active.
6. Select **Start**.

Each visit contains up to three darts. The board pauses while a dart is in flight and while the game collects darts between visits.

## Throw a dart

### Pointer or touch

Press over the board, swipe upward toward a target, and release. A longer, straighter gesture produces a more accurate impact. Very short or downward gestures do not throw a dart.

On touch devices, the game viewport stays fixed while throwing so the browser cannot interpret a dart gesture as page scrolling or rubber-banding. Setup and score controls remain available in their own scrollable panel.

### Keyboard-friendly control

Choose a target from **Keyboard aim**, then activate **Throw**. This control offers common triple, double, and bull targets without requiring a drag gesture. Standard keyboard navigation and visible focus indicators are supported throughout the interface.

The game announces turn and hit updates through a polite live region. The completion dialog contains keyboard focus; Escape closes it and returns to setup. Reduced-motion preferences shorten visual transitions.

## Board scoring

- A numbered single scores the face value.
- The narrow outer ring doubles the number.
- The narrow inner ring triples the number.
- Outer bull scores 25.
- Bullseye scores 50.
- A dart outside the double ring scores zero.

The board follows the standard clockwise number order beginning with 20 at the top.

## Count Up

Count Up lasts eight rounds. Every dart adds its board value to the player's total, including bull and multiplier rings. The highest total after the last visit wins; equal totals produce a draw.

The best human Count Up score is stored in local browser storage for that device. Clearing site data removes it.

## 301

Each player starts at 301 and subtracts the value of every valid dart. The first player to reach exactly zero wins.

A visit is a bust when a dart would:

- reduce the score below zero;
- leave one point while Double out is active; or
- reach zero without landing in a double or bull while Double out is active.

After a bust, the score returns to its value at the start of that three-dart visit and the turn ends. With Double out disabled, any dart that reaches exactly zero can finish the match.

## Cricket

Cricket uses 20, 19, 18, 17, 16, 15, and bull. A single counts as one mark, a double as two, and a triple as three. Outer bull counts as one bull mark and bullseye as two.

Three marks close a target. Extra marks score the target's value only while at least one opponent still has that target open. A player wins after closing every target and having at least as many points as every opponent. In solo play, closing all targets completes the game.

## Opponents

- **Solo:** one scorecard for uninterrupted practice.
- **Two players:** players alternate three-dart visits on the same device.
- **Vs CPU:** the CPU chooses targets based on the active mode and adds difficulty-based dispersion to each throw.

Rookie is the least consistent level, Pub regular is the middle level, and The House is the most accurate.

## Sound and sharing

The Sound control enables or disables short synthesized hit feedback. No audio file is downloaded. The Share game control uses the browser share sheet when available and falls back to copying the game link.
