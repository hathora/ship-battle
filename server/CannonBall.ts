import { Circle } from "detect-collisions";
import { CannonBall, PlayerName } from "./.rtag/types";

const CANNON_BALL_RADIUS = 5;
const CANNON_BALL_SPEED = 400;

export class InternalCannonBall {
  public id: number;
  public firedBy: PlayerName;
  public body: Circle;
  public angle: number;

  public constructor(id: number, firedBy: PlayerName, x: number, y: number, angle: number) {
    this.id = id;
    this.firedBy = firedBy;
    this.body = new Circle(x, y, CANNON_BALL_RADIUS);
    this.angle = angle;
  }

  public update(timeDelta: number) {
    this.body.x += Math.cos(this.angle) * CANNON_BALL_SPEED * timeDelta;
    this.body.y += Math.sin(this.angle) * CANNON_BALL_SPEED * timeDelta;
  }

  public toPlayerState(): CannonBall {
    return { id: this.id, x: this.body.x, y: this.body.y };
  }
}
