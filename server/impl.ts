import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  ICreateGameRequest,
  IFireCannonRequest,
  ISetRotationRequest,
  Rotation,
  PlayerName,
} from "./.rtag/types";
import { Collisions, Circle, Polygon } from "detect-collisions";

interface InternalShip {
  player: PlayerName;
  body: Polygon;
  rotation: Rotation;
  hitCount: number;
  lastFiredAt: number;
}

interface InternalCannonBall {
  id: number;
  firedBy: PlayerName;
  body: Circle;
  angle: number;
}

interface InternalState {
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
  updatedAt: number;
}

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

const SHIP_WIDTH = 113;
const SHIP_HEIGHT = 66;
const SHIP_LINEAR_SPEED = 100;
const SHIP_ANGULAR_SPEED = 0.5;
const SHIP_RELOAD_TIME = 5000;
const MAX_SHIP_HITS = 3;

const CANNON_BALL_RADIUS = 5;
const CANNON_BALL_SPEED = 400;

const system = new Collisions();

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return { ships: [createShip(user.name)], cannonBalls: [], updatedAt: 0 };
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
    if (ship.hitCount === MAX_SHIP_HITS) {
      return Result.unmodified("Ship is distroyed");
    }
    if (ctx.time() - ship.lastFiredAt < SHIP_RELOAD_TIME) {
      return Result.unmodified("Reloading");
    }
    ship.lastFiredAt = ctx.time();
    state.cannonBalls.push(createCannonBall(ctx.randInt(), ship, Math.PI / 2));
    state.cannonBalls.push(createCannonBall(ctx.randInt(), ship, -Math.PI / 2));
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
    state.ships.forEach((ship) => {
      if (ship.hitCount === MAX_SHIP_HITS) {
        return;
      }
      if (ship.rotation === Rotation.LEFT) {
        ship.body.angle -= SHIP_ANGULAR_SPEED * timeDelta;
      } else if (ship.rotation === Rotation.RIGHT) {
        ship.body.angle += SHIP_ANGULAR_SPEED * timeDelta;
      }
      move(ship.body, ship.body.angle, SHIP_LINEAR_SPEED, timeDelta);
      state.updatedAt = ctx.time();
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      move(cannonBall.body, cannonBall.angle, CANNON_BALL_SPEED, timeDelta);
      const { x, y } = cannonBall.body;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        state.cannonBalls.splice(idx, 1);
      }
      state.updatedAt = ctx.time();
    });
    system.update();
    state.ships.forEach((ship) => {
      state.cannonBalls.forEach((cannonBall, idx) => {
        if (ship.player !== cannonBall.firedBy && ship.body.collides(cannonBall.body)) {
          if (ship.hitCount < MAX_SHIP_HITS) {
            ship.hitCount++;
          }
          state.cannonBalls.splice(idx, 1);
        }
      });
    });
    return Result.modified();
  }
}

function createShip(player: PlayerName) {
  const body = system.createPolygon(0, 0, [
    [-SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
    [SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
    [SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
    [-SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
  ]);
  return { player, body, rotation: Rotation.FORWARD, hitCount: 0, lastFiredAt: 0 };
}

function createCannonBall(id: number, ship: InternalShip, dAngle: number) {
  const body = system.createCircle(ship.body.x, ship.body.y, CANNON_BALL_RADIUS);
  return { id, firedBy: ship.player, body, angle: ship.body.angle + dAngle };
}

function move(location: { x: number; y: number }, angle: number, speed: number, timeDelta: number) {
  location.x += Math.cos(angle) * speed * timeDelta;
  location.y += Math.sin(angle) * speed * timeDelta;
}
