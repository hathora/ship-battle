import { System } from "detect-collisions";
import { UserId, CannonBall } from "../api/types";

const CANNON_BALL_RADIUS = 5;
const CANNON_BALL_SPEED = 400;

export class InternalCannonBall {
  public body;

  public constructor(
    public id: number,
    public firedBy: UserId,
    system: System,
    x: number,
    y: number,
    public angle: number
  ) {
    this.body = system.createCircle({ x, y }, CANNON_BALL_RADIUS);
  }

  public update(timeDelta: number) {
    this.body.setPosition(
      this.body.pos.x + Math.cos(this.angle) * CANNON_BALL_SPEED * timeDelta,
      this.body.pos.y + Math.sin(this.angle) * CANNON_BALL_SPEED * timeDelta
    );
  }

  public toPlayerState(): CannonBall {
    return { id: this.id, x: this.body.pos.x, y: this.body.pos.y };
  }
}
