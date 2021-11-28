import { PlayerState } from "./.rtag/types";

type Entity = { x: number; y: number; angle?: number };

export class StateBuffer {
  private clientStartTime: number | undefined;
  private buffer: PlayerState[] = [];

  constructor(private restingState: PlayerState) {}

  public enqueue(state: PlayerState) {
    this.buffer.push(state);
  }

  public getInterpolatedState(now: number): PlayerState {
    if (this.buffer.length === 0) {
      return this.restingState;
    }

    if (this.buffer[this.buffer.length - 1].updatedAt <= now) {
      this.clientStartTime = undefined;
      this.restingState = this.buffer[this.buffer.length - 1];
      this.buffer = [];
      return this.restingState;
    }

    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].updatedAt <= now) {
        this.clientStartTime = undefined;
        this.buffer.splice(0, i);
        return lerp(this.buffer[0], this.buffer[1], now);
      }
    }

    if (this.clientStartTime === undefined) {
      this.clientStartTime = now;
    }
    return lerp({ ...this.restingState, updatedAt: this.clientStartTime }, this.buffer[0], now);
  }
}

function lerp(from: PlayerState, to: PlayerState, now: number): PlayerState {
  const pctElapsed = (now - from.updatedAt) / (to.updatedAt - from.updatedAt);
  return {
    ships: to.ships.map((toShip) => {
      const fromShip = from.ships.find((s) => s.player === toShip.player);
      return fromShip !== undefined ? lerpEntity(fromShip, toShip, pctElapsed) : toShip;
    }),
    cannonBalls: to.cannonBalls.map((toCannonBall) => {
      const fromCannonBall = from.cannonBalls.find((c) => c.id === toCannonBall.id);
      return fromCannonBall !== undefined ? lerpEntity(fromCannonBall, toCannonBall, pctElapsed) : toCannonBall;
    }),
    updatedAt: now,
  };
}

function lerpEntity<T extends Entity>(from: T, to: T, pctElapsed: number): T {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dAngle = (to.angle ?? 0) - (from.angle ?? 0);
  return {
    ...from,
    x: from.x + dx * pctElapsed,
    y: from.y + dy * pctElapsed,
    angle: (from.angle ?? 0) + dAngle * pctElapsed,
  };
}
