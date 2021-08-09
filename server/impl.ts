import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  ICreateGameRequest,
  IFireCannonRequest,
  ISetOrientationRequest,
  Orientation,
  PlayerName,
} from "./.rtag/types";
import { Collisions, Circle, Polygon } from "detect-collisions";

interface InternalShip {
  player: PlayerName;
  body: Polygon;
  orientation: Orientation;
  accelerating: boolean;
  velocity: number;
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
const SHIP_ACCELERATION = 5;
const SHIP_MAX_VELOCITY = 100;
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
  setOrientation(state: InternalState, user: UserData, ctx: Context, request: ISetOrientationRequest): Result {
    const ship = state.ships.find((s) => s.player === user.name);
    if (ship === undefined) {
      state.ships.push(createShip(user.name));
      return Result.modified();
    }
    if (ship.hitCount >= MAX_SHIP_HITS) {
      return Result.unmodified("Ship is distroyed");
    }
    ship.orientation = request.orientation;
    ship.accelerating = request.accelerating;
    return Result.modified();
  }
  fireCannon(state: InternalState, user: UserData, ctx: Context, request: IFireCannonRequest): Result {
    const ship = state.ships.find((s) => s.player === user.name);
    if (ship === undefined) {
      state.ships.push(createShip(user.name));
      return Result.modified();
    }
    if (ship.hitCount >= MAX_SHIP_HITS) {
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
      ships: state.ships.map(({ player, body, hitCount }) => ({
        player,
        x: body.x,
        y: body.y,
        angle: body.angle,
        hitCount,
      })),
      cannonBalls: state.cannonBalls.map(({ id, body }) => ({ id, x: body.x, y: body.y })),
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.ships.forEach((ship) => {
      if (ship.orientation === Orientation.LEFT) {
        ship.body.angle -= SHIP_ANGULAR_SPEED * timeDelta;
        modified = true;
      } else if (ship.orientation === Orientation.RIGHT) {
        ship.body.angle += SHIP_ANGULAR_SPEED * timeDelta;
        modified = true;
      }
      if (ship.accelerating) {
        ship.velocity = Math.min(ship.velocity + SHIP_ACCELERATION, SHIP_MAX_VELOCITY);
      } else {
        ship.velocity = Math.max(ship.velocity - SHIP_ACCELERATION, 0);
      }
      if (ship.velocity > 0) {
        move(ship.body, ship.body.angle, ship.velocity, timeDelta);
        state.updatedAt = ctx.time();
        modified = true;
      }
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      move(cannonBall.body, cannonBall.angle, CANNON_BALL_SPEED, timeDelta);
      const { x, y } = cannonBall.body;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        state.cannonBalls.splice(idx, 1);
      }
      state.updatedAt = ctx.time();
      modified = true;
    });
    if (modified) {
      system.update();
      state.ships.forEach((ship) => {
        state.cannonBalls.forEach((cannonBall, idx) => {
          if (ship.player !== cannonBall.firedBy && ship.body.collides(cannonBall.body)) {
            ship.hitCount++;
            if (ship.hitCount >= MAX_SHIP_HITS) {
              ship.orientation = Orientation.FORWARD;
              ship.accelerating = false;
            }
            state.cannonBalls.splice(idx, 1);
            system.remove(cannonBall.body);
          }
        });
      });
      return Result.modified();
    }
    return Result.unmodified();
  }
}

function createShip(player: PlayerName) {
  const body = system.createPolygon(0, 0, [
    [-SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
    [SHIP_WIDTH / 2, -SHIP_HEIGHT / 2],
    [SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
    [-SHIP_WIDTH / 2, SHIP_HEIGHT / 2],
  ]);
  return {
    player,
    body,
    orientation: Orientation.FORWARD,
    accelerating: false,
    velocity: 0,
    hitCount: 0,
    lastFiredAt: 0,
  };
}

function createCannonBall(id: number, ship: InternalShip, dAngle: number) {
  const body = system.createCircle(ship.body.x, ship.body.y, CANNON_BALL_RADIUS);
  return { id, firedBy: ship.player, body, angle: ship.body.angle + dAngle };
}

function move(location: { x: number; y: number }, angle: number, speed: number, timeDelta: number) {
  location.x += Math.cos(angle) * speed * timeDelta;
  location.y += Math.sin(angle) * speed * timeDelta;
}
