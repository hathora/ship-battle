import { Orientation, PlayerName, Ship } from "./.rtag/types";
import { Polygon } from "detect-collisions";

const SHIP_WIDTH = 113;
const SHIP_HEIGHT = 66;
const SHIP_ACCELERATION = 5;
const SHIP_MAX_VELOCITY = 200;
const SHIP_ANGULAR_SPEED = 0.5;
const SHIP_RELOAD_TIME = 5000;
const MAX_SHIP_HITS = 3;

export class InternalShip {
  public body;
  public orientation = Orientation.FORWARD;
  public accelerating = false;
  public velocity = 0;
  public hitCount = 0;
  public lastFiredAt = 0;
  public _modCnt = 0;

  public constructor(public player: PlayerName) {
    this.body = new Polygon(0, 0, [
      [-SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
      [SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
      [SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
      [-SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
    ]);
  }

  public setOrientation(orientation: Orientation, accelerating: boolean): boolean {
    if (this.hitCount === MAX_SHIP_HITS) {
      return false;
    }
    this.orientation = orientation;
    this.accelerating = accelerating;
    this._modCnt++;
    return true;
  }

  public fire(time: number): boolean {
    if (this.hitCount === MAX_SHIP_HITS) {
      return false;
    }
    if (time - this.lastFiredAt < SHIP_RELOAD_TIME) {
      return false;
    }
    this.lastFiredAt = time;
    this._modCnt++;
    return true;
  }

  public update(timeDelta: number): boolean {
    if (this.hitCount === MAX_SHIP_HITS) {
      return false;
    }
    const oldModCnt = this._modCnt;
    if (this.orientation === Orientation.LEFT) {
      this.body.angle -= SHIP_ANGULAR_SPEED * timeDelta;
      this._modCnt++;
    } else if (this.orientation === Orientation.RIGHT) {
      this.body.angle += SHIP_ANGULAR_SPEED * timeDelta;
      this._modCnt++;
    }
    if (this.accelerating) {
      this.velocity = Math.min(this.velocity + SHIP_ACCELERATION, SHIP_MAX_VELOCITY);
    } else {
      this.velocity = Math.max(this.velocity - SHIP_ACCELERATION, 0);
    }
    if (this.velocity > 0) {
      this.body.x += Math.cos(this.body.angle) * this.velocity * timeDelta;
      this.body.y += Math.sin(this.body.angle) * this.velocity * timeDelta;
      this._modCnt++;
    }
    return this._modCnt > oldModCnt;
  }

  public handleCollision() {
    if (this.hitCount < MAX_SHIP_HITS) {
      this.hitCount++;
      this._modCnt++;
    }
  }

  public die() {
    this.hitCount = MAX_SHIP_HITS;
    this._modCnt++;
  }

  public toPlayerState(): Ship {
    return { player: this.player, x: this.body.x, y: this.body.y, angle: this.body.angle, hitCount: this.hitCount };
  }
}
