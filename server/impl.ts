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

interface InternalShip {
  player: PlayerName;
  location: Point;
  angle: number;
  rotation: Rotation;
  lastFiredAt: number;
}

interface InternalCannonBall {
  id: string;
  location: Point;
  angle: number;
}

interface InternalState {
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
  updatedAt: number;
}

const SHIP_LINEAR_SPEED = 100;
const SHIP_ANGULAR_SPEED = 0.5;
const SHIP_RELOAD_TIME = 5000;
const CANNON_BALL_LINEAR_SPEED = 400;

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
    state.cannonBalls.push({
      id: ctx.rand().toString(36).substring(2),
      location: { ...ship.location },
      angle: ship.angle + Math.PI / 2,
    });
    state.cannonBalls.push({
      id: ctx.rand().toString(36).substring(2),
      location: { ...ship.location },
      angle: ship.angle - Math.PI / 2,
    });
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    return {
      ships: state.ships.map(({ player, location, angle, rotation }) => ({ player, location, angle, rotation })),
      cannonBalls: state.cannonBalls.map(({ id, location }) => ({ id, location })),
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.ships.forEach((ship) => {
      if (ship.rotation === Rotation.LEFT) {
        ship.angle -= SHIP_ANGULAR_SPEED * timeDelta;
      } else if (ship.rotation === Rotation.RIGHT) {
        ship.angle += SHIP_ANGULAR_SPEED * timeDelta;
      }
      const dx = Math.cos(ship.angle) * SHIP_LINEAR_SPEED * timeDelta;
      const dy = Math.sin(ship.angle) * SHIP_LINEAR_SPEED * timeDelta;
      ship.location.x += dx;
      ship.location.y += dy;
      state.updatedAt = ctx.time();
      modified = true;
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      const dx = Math.cos(cannonBall.angle) * CANNON_BALL_LINEAR_SPEED * timeDelta;
      const dy = Math.sin(cannonBall.angle) * CANNON_BALL_LINEAR_SPEED * timeDelta;
      cannonBall.location.x += dx;
      cannonBall.location.y += dy;
      if (
        cannonBall.location.x < 0 ||
        cannonBall.location.y < 0 ||
        cannonBall.location.x >= 1200 ||
        cannonBall.location.y >= 900
      ) {
        state.cannonBalls.splice(idx, 1);
      }
      state.updatedAt = ctx.time();
      modified = true;
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}

function createShip(player: string) {
  return { player, location: { x: 0, y: 0 }, angle: 0, rotation: Rotation.FORWARD, lastFiredAt: 0 };
}
