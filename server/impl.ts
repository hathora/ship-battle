import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import { UserId, PlayerState, IFireCannonRequest, ISetOrientationRequest, IJoinGameRequest } from "../api/types";
import { InternalShip } from "./Ship";
import { InternalCannonBall } from "./CannonBall";
import { System } from "detect-collisions";

type InternalState = {
  system: System;
  ships: InternalShip[];
  cannonBalls: InternalCannonBall[];
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

export class Impl implements Methods<InternalState> {
  initialize(userId: UserId, ctx: Context): InternalState {
    const system = new System();
    return { system, ships: [createShip(userId, system, ctx)], cannonBalls: [] };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    if (state.ships.find((s) => s.player === userId) !== undefined) {
      return Response.error("Already joined");
    }
    if (state.ships.length >= 6) {
      return Response.error("Room is full");
    }
    state.ships.push(createShip(userId, state.system, ctx));
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
    state.cannonBalls.push(createCannonBall(ctx.chance.integer({ min: 0, max: 1e6 }), state.system, ship, Math.PI / 2));
    state.cannonBalls.push(
      createCannonBall(ctx.chance.integer({ min: 0, max: 1e6 }), state.system, ship, -Math.PI / 2)
    );
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
      const { x, y } = ship.body.pos;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        ship.die();
      }
    });
    for (let i = state.cannonBalls.length - 1; i >= 0; i--) {
      state.cannonBalls[i].update(timeDelta);
      const { x, y } = state.cannonBalls[i].body.pos;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
        state.cannonBalls.splice(i, 1);
      }
    }
    state.system.checkAll((response) => {
      console.log("response.a", response.a);
      console.log("response.b", response.b);
    });
  }
}

function createShip(player: UserId, system: System, ctx: Context) {
  return new InternalShip(
    player,
    system,
    ctx.chance.integer({ min: 0, max: MAP_WIDTH }),
    ctx.chance.integer({ min: 0, max: MAP_HEIGHT })
  );
}

function createCannonBall(id: number, system: System, ship: InternalShip, dAngle: number) {
  return new InternalCannonBall(id, ship.player, system, ship.body.pos.x, ship.body.pos.y, ship.body.angle + dAngle);
}
