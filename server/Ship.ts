import { Orientation, PlayerName, Ship } from "./.rtag/types";
import { Polygon } from "detect-collisions";

const SHIP_WIDTH = 113;
const SHIP_HEIGHT = 66;
const SHIP_ACCELERATION = 5;
const SHIP_MAX_VELOCITY = 100;
const SHIP_ANGULAR_SPEED = 0.5;
const SHIP_RELOAD_TIME = 5000;
const MAX_SHIP_HITS = 3;

export class InternalShip {
  public player: PlayerName;
  public body: Polygon;
  public orientation: Orientation = Orientation.FORWARD;
  public accelerating: boolean = false;
  public velocity: number = 0;
  public hitCount: number = 0;
  public lastFiredAt: number = 0;

  public constructor(player: PlayerName) {
    this.player = player;
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
    return true;
  }

  public update(timeDelta: number): boolean {
    if (this.orientation === Orientation.LEFT) {
      this.body.angle -= SHIP_ANGULAR_SPEED * timeDelta;
    } else if (this.orientation === Orientation.RIGHT) {
      this.body.angle += SHIP_ANGULAR_SPEED * timeDelta;
    }
    if (this.accelerating) {
      this.velocity = Math.min(this.velocity + SHIP_ACCELERATION, SHIP_MAX_VELOCITY);
    } else {
      this.velocity = Math.max(this.velocity - SHIP_ACCELERATION, 0);
    }
    if (this.velocity > 0) {
      this.body.x += Math.cos(this.body.angle) * this.velocity * timeDelta;
      this.body.y += Math.sin(this.body.angle) * this.velocity * timeDelta;
    }
    return this.orientation !== Orientation.FORWARD || this.velocity > 0;
  }

  public handleCollision() {
    if (this.hitCount < MAX_SHIP_HITS) {
      this.hitCount++;
      if (this.hitCount === MAX_SHIP_HITS) {
        this.orientation = Orientation.FORWARD;
        this.accelerating = false;
      }
    }
  }

  public toPlayerState(): Ship {
    return { player: this.player, x: this.body.x, y: this.body.y, angle: this.body.angle, hitCount: this.hitCount };
  }
}
