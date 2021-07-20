import { Methods, Context, Result } from "./.rtag/methods";
import { UserData, PlayerState, ICreateGameRequest, IUpdateShipTargetRequest, Point, EntityType } from "./.rtag/types";

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

const ENTITY_SPEEDS: Map<EntityType, number> = new Map([[EntityType.SHIP, 200]]);

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      entities: [{ id: user.name, type: EntityType.SHIP, location: { x: 0, y: 0 }, target: { x: 0, y: 0 } }],
      updatedAt: 0,
    };
  }
  updateShipTarget(state: InternalState, user: UserData, ctx: Context, request: IUpdateShipTargetRequest): Result {
    const entity = state.entities.find((p) => p.id == user.name);
    if (entity === undefined) {
      state.entities.push({ id: user.name, type: EntityType.SHIP, location: request.target, target: request.target });
    } else {
      entity.target = request.target;
    }
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
    state.entities.forEach((entity) => {
      const dx = entity.target.x - entity.location.x;
      const dy = entity.target.y - entity.location.y;
      if (dx !== 0 || dy !== 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pixelsToMove = ENTITY_SPEEDS.get(entity.type)! * timeDelta;
        if (dist <= pixelsToMove) {
          entity.location = entity.target;
        } else {
          entity.location.x += (dx / dist) * pixelsToMove;
          entity.location.y += (dy / dist) * pixelsToMove;
        }
        state.updatedAt = Date.now();
        modified = true;
      }
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}
