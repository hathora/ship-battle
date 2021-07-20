import { Point } from "./.rtag/types";

export class Entity {
  restingLocation: Point;
  clientStartTime: number | undefined;
  buffer: { location: Point; time: number }[] = [];

  constructor(location: Point) {
    this.restingLocation = location;
  }

  updateTarget(target: Point, time: number) {
    if (target.x !== this.restingLocation.x || target.y !== this.restingLocation.y) {
      this.buffer.push({ location: target, time });
    }
  }

  getCurrPos(now: number) {
    if (this.buffer.length === 0) {
      return this.restingLocation;
    }

    if (this.buffer[this.buffer.length - 1].time <= now) {
      this.clientStartTime = undefined;
      this.restingLocation = this.buffer[this.buffer.length - 1].location;
      this.buffer = [];
      return this.restingLocation;
    }

    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].time <= now) {
        this.clientStartTime = undefined;
        const [from, to] = [this.buffer[i], this.buffer[i + 1]];
        this.buffer.splice(0, i);
        return lerp(from, to, now);
      }
    }

    if (this.clientStartTime === undefined) {
      this.clientStartTime = now;
    }
    return lerp({ location: this.restingLocation, time: this.clientStartTime }, this.buffer[0], now);
  }
}

function lerp(from: { location: Point; time: number }, to: { location: Point; time: number }, now: number) {
  const dx = to.location.x - from.location.x;
  const dy = to.location.y - from.location.y;
  const pctElapsed = (now - from.time) / (to.time - from.time);
  return { x: from.location.x + dx * pctElapsed, y: from.location.y + dy * pctElapsed };
}
