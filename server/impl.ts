import { Methods, Context } from "./.rtag/methods";
import { UserData, Response } from "./.rtag/base";
import {
  PlayerState,
  PlayerName,
  ICreateGameRequest,
  IFireCannonRequest,
  ISetOrientationRequest,
  IJoinGameRequest,
} from "./.rtag/types";
import { Collisions } from "detect-collisions";
import { InternalShip } from "./Ship";
import { InternalCannonBall } from "./CannonBall";

type InternalState = {
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
  updatedAt: number;
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

const system = new Collisions();

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return { ships: [createShip(user.name)], cannonBalls: [], updatedAt: 0 };
  }
  joinGame(state: InternalState, user: UserData, ctx: Context, request: IJoinGameRequest): Response {
    if (state.ships.find((s) => s.player === user.name) !== undefined) {
      return Response.error("Already joined");
    }
    state.ships.push(createShip(user.name));
    return Response.ok();
  }
  setOrientation(state: InternalState, user: UserData, ctx: Context, request: ISetOrientationRequest): Response {
    const ship = state.ships.find((s) => s.player === user.name);
    if (ship === undefined) {
      return Response.error("Not joined game");
    }
    if (!ship.setOrientation(request.orientation, request.accelerating)) {
      return Response.error("Invalid action");
    }
    return Response.ok();
  }
  fireCannon(state: InternalState, user: UserData, ctx: Context, request: IFireCannonRequest): Response {
    const ship = state.ships.find((s) => s.player === user.name);
    if (ship === undefined) {
      return Response.error("Not joined game");
    }
    if (!ship.fire(ctx.time())) {
      return Response.error("Invalid action");
    }
    state.cannonBalls.push(createCannonBall(ctx.randInt(), ship, Math.PI / 2));
    state.cannonBalls.push(createCannonBall(ctx.randInt(), ship, -Math.PI / 2));
    return Response.ok();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    return {
      ships: state.ships.map((ship) => ship.toPlayerState()),
      cannonBalls: state.cannonBalls.map((cannonBall) => cannonBall.toPlayerState()),
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): void {
    state.ships.forEach((ship) => {
      if (ship.update(timeDelta)) {
        state.updatedAt = ctx.time();
      }
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      cannonBall.update(timeDelta);
      const { x, y } = cannonBall.body;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        cannonBall.body.remove();
        state.cannonBalls.splice(idx, 1);
      }
      state.updatedAt = ctx.time();
    });
    system.update();
    state.ships.forEach((ship) => {
      state.cannonBalls.forEach((cannonBall, idx) => {
        if (ship.player !== cannonBall.firedBy && ship.body.collides(cannonBall.body)) {
          ship.handleCollision();
          state.cannonBalls.splice(idx, 1);
          cannonBall.body.remove();
        }
      });
    });
  }
}

function createShip(player: PlayerName) {
  const ship = new InternalShip(player);
  system.insert(ship.body);
  return ship;
}

function createCannonBall(id: number, ship: InternalShip, dAngle: number) {
  const cannonBall = new InternalCannonBall(id, ship.player, ship.body.x, ship.body.y, ship.body.angle + dAngle);
  system.insert(cannonBall.body);
  return cannonBall;
}
