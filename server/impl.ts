import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  ICreateGameRequest,
  IFireCannonRequest,
  ISetRotationRequest,
  Rotation,
  Point,
  PlayerName,
} from "./.rtag/types";
import { Collisions, Polygon } from "detect-collisions";

interface InternalShip {
  player: PlayerName;
  body: Polygon;
  rotation: Rotation;
  hitCount: number;
  lastFiredAt: number;
}

interface InternalCannonBall {
  id: string;
  body: Polygon;
}

interface InternalState {
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
  updatedAt: number;
}

const SHIP_WIDTH = 113;
const SHIP_HEIGHT = 66;
const SHIP_LINEAR_SPEED = 100;
const SHIP_ANGULAR_SPEED = 0.5;
const SHIP_RELOAD_TIME = 5000;

const CANNON_BALL_WIDTH = 10;
const CANNON_BALL_HEIGHT = 10;
const CANNON_BALL_LINEAR_SPEED = 400;

const system = new Collisions();

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      ships: [createShip(user.name)],
      cannonBalls: [],
      updatedAt: 0,
    };
  }
  setRotation(state: InternalState, user: UserData, ctx: Context, request: ISetRotationRequest): Result {
    const ship = state.ships.find((ship) => ship.player === user.name);
    if (ship === undefined) {
      state.ships.push(createShip(user.name));
      return Result.modified();
    }
    ship.rotation = request.rotation;
    return Result.modified();
  }
  fireCannon(state: InternalState, user: UserData, ctx: Context, request: IFireCannonRequest): Result {
    const ship = state.ships.find((ship) => ship.player === user.name);
    if (ship === undefined) {
      state.ships.push(createShip(user.name));
      return Result.modified();
    }
    if (ctx.time() - ship.lastFiredAt < SHIP_RELOAD_TIME) {
      return Result.unmodified("Reloading");
    }
    ship.lastFiredAt = ctx.time();
    state.cannonBalls.push(createCannonBall(ctx.rand().toString(36).substring(2), ship, Math.PI / 2));
    state.cannonBalls.push(createCannonBall(ctx.rand().toString(36).substring(2), ship, -Math.PI / 2));
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    return {
      ships: state.ships.map(({ player, body, rotation, hitCount }) => ({
        player,
        location: { x: body.x, y: body.y },
        angle: body.angle,
        rotation,
        hitCount,
      })),
      cannonBalls: state.cannonBalls.map(({ id, body }) => ({ id, location: { x: body.x, y: body.y } })),
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.ships.forEach((ship) => {
      if (ship.rotation === Rotation.LEFT) {
        ship.body.angle -= SHIP_ANGULAR_SPEED * timeDelta;
      } else if (ship.rotation === Rotation.RIGHT) {
        ship.body.angle += SHIP_ANGULAR_SPEED * timeDelta;
      }
      move(ship.body, SHIP_LINEAR_SPEED, timeDelta);
      state.updatedAt = ctx.time();
      modified = true;
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      move(cannonBall.body, CANNON_BALL_LINEAR_SPEED, timeDelta);
      if (cannonBall.body.x < 0 || cannonBall.body.y < 0 || cannonBall.body.x >= 1200 || cannonBall.body.y >= 900) {
        state.cannonBalls.splice(idx, 1);
      }
      state.updatedAt = ctx.time();
      modified = true;
    });
    system.update();
    state.ships.forEach((ship) => {
      state.cannonBalls.forEach((cannonBall, idx) => {
        if (ship.body.collides(cannonBall.body)) {
          ship.hitCount++;
          state.cannonBalls.splice(idx, 1);
        }
      });
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}

function createShip(player: string) {
  const body = system.createPolygon(0, 0, [
    [0, 0],
    [SHIP_WIDTH, 0],
    [SHIP_WIDTH, SHIP_HEIGHT],
    [0, SHIP_HEIGHT],
  ]);
  return { player, body, rotation: Rotation.FORWARD, hitCount: 0, lastFiredAt: 0 };
}

function createCannonBall(id: string, ship: InternalShip, dAngle: number) {
  const body = system.createPolygon(
    ship.body.x,
    ship.body.y,
    [
      [0, 0],
      [CANNON_BALL_WIDTH, 0],
      [CANNON_BALL_WIDTH, CANNON_BALL_HEIGHT],
      [0, CANNON_BALL_HEIGHT],
    ],
    ship.body.angle + dAngle
  );
  return { id, body };
}

function move(entity: Polygon, speed: number, timeDelta: number) {
  const dx = Math.cos(entity.angle) * speed * timeDelta;
  const dy = Math.sin(entity.angle) * speed * timeDelta;
  entity.x += dx;
  entity.y += dy;
}
