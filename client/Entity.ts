import { Point } from "./.rtag/types";

export class Entity {
  restingLocation: Point;
  restingAngle: number;
  clientStartTime: number | undefined;
  buffer: { location: Point; angle: number; time: number }[] = [];

  constructor(location: Point, angle: number) {
    this.restingLocation = location;
    this.restingAngle = angle;
  }

  updateTarget(target: Point, angle: number, time: number) {
    this.buffer.push({ location: target, angle, time });
  }

  getCurrPos(now: number) {
    if (this.buffer.length === 0) {
      return { location: this.restingLocation, angle: this.restingAngle };
    }

    if (this.buffer[this.buffer.length - 1].time <= now) {
      this.clientStartTime = undefined;
      this.restingLocation = this.buffer[this.buffer.length - 1].location;
      this.restingAngle = this.buffer[this.buffer.length - 1].angle;
      this.buffer = [];
      return { location: this.restingLocation, angle: this.restingAngle };
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
    return lerp(
      { location: this.restingLocation, angle: this.restingAngle, time: this.clientStartTime },
      this.buffer[0],
      now
    );
  }
}

function lerp(
  from: { location: Point; angle: number; time: number },
  to: { location: Point; angle: number; time: number },
  now: number
) {
  const dx = to.location.x - from.location.x;
  const dy = to.location.y - from.location.y;
  const dAngle = to.angle - from.angle;
  const pctElapsed = (now - from.time) / (to.time - from.time);
  const location = { x: from.location.x + dx * pctElapsed, y: from.location.y + dy * pctElapsed };
  const angle = from.angle + dAngle * pctElapsed;
  return { location, angle };
}
