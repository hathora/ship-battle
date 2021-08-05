import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  EntityType,
  ICreateGameRequest,
  IMoveShipRequest,
  IFireCannonRequest,
  Entity,
} from "./.rtag/types";

interface InternalState {
  entities: Entity[];
  updatedAt: number;
}

const ENTITY_SPEEDS: Map<EntityType, number> = new Map([
  [EntityType.SHIP, 200],
  [EntityType.CANNON_BALL, 400],
]);

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      entities: [{ id: user.name, type: EntityType.SHIP, location: { x: 0, y: 0 }, angle: 0 }],
      updatedAt: 0,
    };
  }
  moveShip(state: InternalState, user: UserData, ctx: Context, request: IMoveShipRequest): Result {
    const entity = state.entities.find((p) => p.id == user.name);
    if (entity === undefined) {
      state.entities.push({
        id: user.name,
        type: EntityType.SHIP,
        location: request.target,
        angle: 0,
      });
    } else {
      entity.angle =
        Math.atan2(request.target.y - entity.location.y, request.target.x - entity.location.x);
    }
    return Result.modified();
  }
  fireCannon(state: InternalState, user: UserData, ctx: Context, request: IFireCannonRequest): Result {
    const location = { ...state.entities.find((entity) => entity.id === user.name)!.location };
    state.entities.push({
      id: ctx.rand().toString(36).substring(2),
      type: EntityType.CANNON_BALL,
      location,
      angle: Math.atan2(request.target.y - location.y, request.target.x - location.x),
    });
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    return { entities: state.entities, updatedAt: state.updatedAt };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.entities.forEach((entity, idx) => {
      const pixelsToMove = ENTITY_SPEEDS.get(entity.type)! * timeDelta;
      const dx = Math.cos(entity.angle) * pixelsToMove;
      const dy = Math.sin(entity.angle) * pixelsToMove;
      entity.location.x += dx;
      entity.location.y += dy;
      state.updatedAt = ctx.time();
      modified = true;
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}
