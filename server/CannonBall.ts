import { Circle } from "detect-collisions";
import { UserId, CannonBall } from "./.hathora/types";

const CANNON_BALL_RADIUS = 5;
const CANNON_BALL_SPEED = 400;

export class InternalCannonBall {
  public body;
  public _modCnt = 0;

  public constructor(public id: number, public firedBy: UserId, x: number, y: number, public angle: number) {
    this.body = new Circle(x, y, CANNON_BALL_RADIUS);
  }

  public update(timeDelta: number) {
    this.body.x += Math.cos(this.angle) * CANNON_BALL_SPEED * timeDelta;
    this.body.y += Math.sin(this.angle) * CANNON_BALL_SPEED * timeDelta;
    this._modCnt++;
  }

  public toPlayerState(): CannonBall {
    return { id: this.id, x: this.body.x, y: this.body.y };
  }
}
