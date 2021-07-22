import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  Point,
  EntityType,
  ICreateGameRequest,
  IMoveShipRequest,
  IFireCannonRequest,
} from "./.rtag/types";

interface InternalEntity {
  id: string;
  type: EntityType;
  location: Point;
  target: Point;
}

interface InternalState {
  entities: InternalEntity[];
  updatedAt: number;
}

const ENTITY_SPEEDS: Map<EntityType, number> = new Map([
  [EntityType.SHIP, 200],
  [EntityType.CANNON_BALL, 400],
]);

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      entities: [{ id: user.name, type: EntityType.SHIP, location: { x: 0, y: 0 }, target: { x: 0, y: 0 } }],
      updatedAt: 0,
    };
  }
  moveShip(state: InternalState, user: UserData, ctx: Context, request: IMoveShipRequest): Result {
    const entity = state.entities.find((p) => p.id == user.name);
    if (entity === undefined) {
      state.entities.push({ id: user.name, type: EntityType.SHIP, location: request.target, target: request.target });
    } else {
      entity.target = request.target;
    }
    return Result.modified();
  }
  fireCannon(state: InternalState, user: UserData, ctx: Context, request: IFireCannonRequest): Result {
    state.entities.push({
      id: ctx.rand().toString(36).substring(2),
      type: EntityType.CANNON_BALL,
      location: { ...state.entities.find((entity) => entity.id === user.name)!.location },
      target: request.target,
    });
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    return {
      entities: state.entities.map(({ id, type, location }) => ({ id, type, location })),
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.entities.forEach((entity, idx) => {
      const dx = entity.target.x - entity.location.x;
      const dy = entity.target.y - entity.location.y;
      if (dx !== 0 || dy !== 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pixelsToMove = ENTITY_SPEEDS.get(entity.type)! * timeDelta;
        if (dist <= pixelsToMove) {
          entity.location = entity.target;
          if (entity.type === EntityType.CANNON_BALL) {
            state.entities.splice(idx, 1);
          }
        } else {
          entity.location.x += (dx / dist) * pixelsToMove;
          entity.location.y += (dy / dist) * pixelsToMove;
        }
        state.updatedAt = ctx.time();
        modified = true;
      }
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}
