import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import { UserId, PlayerState, IFireCannonRequest, ISetOrientationRequest, IJoinGameRequest } from "../api/types";
import { InternalShip } from "./Ship";
import { InternalCannonBall } from "./CannonBall";

type InternalState = {
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

export class Impl implements Methods<InternalState> {
  initialize(userId: UserId, ctx: Context): InternalState {
    return { ships: [createShip(userId, ctx)], cannonBalls: [] };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    if (state.ships.find((s) => s.player === userId) !== undefined) {
      return Response.error("Already joined");
    }
    state.ships.push(createShip(userId, ctx));
    return Response.ok();
  }
  setOrientation(state: InternalState, userId: UserId, ctx: Context, request: ISetOrientationRequest): Response {
    const ship = state.ships.find((s) => s.player === userId);
    if (ship === undefined) {
      return Response.error("Not joined game");
    }
    if (!ship.setOrientation(request.orientation, request.accelerating)) {
      return Response.error("Invalid action");
    }
    return Response.ok();
  }
  fireCannon(state: InternalState, userId: UserId, ctx: Context, request: IFireCannonRequest): Response {
    const ship = state.ships.find((s) => s.player === userId);
    if (ship === undefined) {
      return Response.error("Not joined game");
    }
    if (!ship.fire(ctx.time)) {
      return Response.error("Invalid action");
    }
    state.cannonBalls.push(createCannonBall(ctx.chance.integer({ min: 0, max: 1e6 }), ship, Math.PI / 2));
    state.cannonBalls.push(createCannonBall(ctx.chance.integer({ min: 0, max: 1e6 }), ship, -Math.PI / 2));
    return Response.ok();
  }
  getUserState(state: InternalState, userId: UserId): PlayerState {
    return {
      ships: state.ships.map((ship) => ship.toPlayerState()),
      cannonBalls: state.cannonBalls.map((cannonBall) => cannonBall.toPlayerState()),
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): void {
    state.ships.forEach((ship) => {
      ship.update(timeDelta);
      if (ship.body.x < 0 || ship.body.y < 0 || ship.body.x >= MAP_WIDTH || ship.body.y >= MAP_HEIGHT) {
        ship.die();
      }
    });
    state.cannonBalls.forEach((cannonBall, idx) => {
      cannonBall.update(timeDelta);
      const { x, y } = cannonBall.body;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        state.cannonBalls.splice(idx, 1);
      }
    });

    state.ships.forEach((ship) => {
      state.cannonBalls.forEach((cannonBall, idx) => {
        if (ship.player !== cannonBall.firedBy && ship.body.collides(cannonBall.body)) {
          ship.handleCollision();
          state.cannonBalls.splice(idx, 1);
        }
      });
    });
  }
}

function createShip(player: UserId, ctx: Context) {
  return new InternalShip(
    player,
    ctx.chance.integer({ min: 0, max: MAP_WIDTH }),
    ctx.chance.integer({ min: 0, max: MAP_HEIGHT })
  );
}

function createCannonBall(id: number, ship: InternalShip, dAngle: number) {
  return new InternalCannonBall(id, ship.player, ship.body.x, ship.body.y, ship.body.angle + dAngle);
}
